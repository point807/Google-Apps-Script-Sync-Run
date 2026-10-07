/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { AppsScriptProject, ScriptFile } from '../types';
import {
  buildAppsScriptContentJson,
  buildProjectBundle,
  importSourcesToProject,
  MAX_IMPORT_FILE_BYTES,
  normalizeFiles,
  projectFileEntries,
  projectToZipBlob
} from './projectTransfer';
import {
  appsScriptNameFromFileName,
  fileNameWithExtension,
  isManifestName,
  scriptFileTypeFromFileName
} from './scriptFileNaming';

const file = (name: string, type: ScriptFile['type'], source: string): ScriptFile => ({
  name,
  type,
  source
});

const cloudProject: AppsScriptProject = {
  scriptId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456',
  title: 'Orders Sync',
  parentId: 'sheet-1',
  parentTitle: 'Orders sheet',
  origin: 'cloud',
  files: [
    file('Code', 'SERVER_JS', 'function hello() { return 1; }'),
    file('Index', 'HTML', '<html></html>'),
    file('appsscript', 'JSON', '{"timeZone":"Etc/UTC"}')
  ]
};

const localProject: AppsScriptProject = {
  ...cloudProject,
  scriptId: '1LOCAL_abcdef123456',
  title: 'Imported',
  origin: 'local'
};

describe('scriptFileNaming', () => {
  it('derives extensions from the Apps Script file type', () => {
    expect(fileNameWithExtension(file('Code', 'SERVER_JS', ''))).toBe('Code.gs');
    expect(fileNameWithExtension(file('Index', 'HTML', ''))).toBe('Index.html');
    expect(fileNameWithExtension(file('appsscript', 'JSON', ''))).toBe('appsscript.json');
    expect(fileNameWithExtension(file('Data', 'ENUM', ''))).toBe('Data.gs');
    expect(fileNameWithExtension(file('Code.gs', 'SERVER_JS', ''))).toBe('Code.gs');
  });

  it('maps file names back to Apps Script names', () => {
    expect(appsScriptNameFromFileName('Code.gs')).toBe('Code');
    expect(appsScriptNameFromFileName('ReportsHelper.js')).toBe('ReportsHelper');
    expect(appsScriptNameFromFileName('appsscript.json')).toBe('appsscript');
    expect(appsScriptNameFromFileName('src/lib/utils.gs')).toBe('utils');
    expect(appsScriptNameFromFileName('my.file.gs')).toBe('my_file');
    expect(appsScriptNameFromFileName('.DS_Store')).toBe('DS_Store');
    expect(appsScriptNameFromFileName('')).toBe('Untitled');
  });

  it('infers file types', () => {
    expect(scriptFileTypeFromFileName('appsscript.json')).toBe('JSON');
    expect(scriptFileTypeFromFileName('Index.html')).toBe('HTML');
    expect(scriptFileTypeFromFileName('config.json')).toBe('JSON');
    expect(scriptFileTypeFromFileName('Code.gs')).toBe('SERVER_JS');
    expect(scriptFileTypeFromFileName('Code.js')).toBe('SERVER_JS');
    expect(scriptFileTypeFromFileName('README')).toBe('SERVER_JS');
    expect(isManifestName('appsscript.json')).toBe(true);
    expect(isManifestName('Appsscript')).toBe(true);
  });
});

describe('normalizeFiles', () => {
  it('drops duplicate and blank names, keeping the first version', () => {
    const warnings: string[] = [];
    const files = normalizeFiles(
      [file('Code', 'SERVER_JS', 'a'), file('code', 'SERVER_JS', 'b'), file('  ', 'HTML', 'c')],
      warnings
    );
    expect(files).toEqual([file('Code', 'SERVER_JS', 'a')]);
    expect(warnings).toHaveLength(2);
  });
});

describe('bundle export/import', () => {
  it('round-trips a cloud project losslessly', async () => {
    const bundle = buildProjectBundle(cloudProject);
    const { project, warnings, sourceKind } = await importSourcesToProject([
      { name: 'Orders_Sync.json', text: bundle }
    ]);

    expect(sourceKind).toBe('bundle');
    expect(warnings).toEqual([]);
    expect(project.scriptId).toBe(cloudProject.scriptId);
    expect(project.title).toBe(cloudProject.title);
    expect(project.parentId).toBe(cloudProject.parentId);
    expect(project.origin).toBe('cloud');
    expect(project.files).toEqual(cloudProject.files);
  });

  it('keeps local origin and generated ids for local projects', async () => {
    const { project } = await importSourcesToProject([
      { name: 'bundle.json', text: buildProjectBundle(localProject) }
    ]);
    expect(project.origin).toBe('local');
    expect(project.scriptId).toBe(localProject.scriptId);
  });

  it('rejects JSON that is not a bundle', async () => {
    await expect(
      importSourcesToProject([{ name: 'bundle.json', text: JSON.stringify({ files: [] }) }])
    ).resolves.toBeTruthy();
  });

  it('rejects a corrupted bundle payload', async () => {
    await expect(
      importSourcesToProject([{ name: 'x.json', text: '{ "format": "scriptvault-project" ' }])
    ).rejects.toThrow(/бандл|JSON/i);
  });

  it('warns that extra files next to a bundle are ignored', async () => {
    const result = await importSourcesToProject([
      { name: 'bundle.json', text: buildProjectBundle(cloudProject) },
      { name: 'Extra.gs', text: 'function x() {}' }
    ]);
    expect(result.sourceKind).toBe('bundle');
    expect(result.warnings.join(' ')).toMatch(/дополнительн/i);
  });
});

describe('import from source files', () => {
  it('builds a local project and adds a manifest when missing', async () => {
    const { project, warnings, sourceKind } = await importSourcesToProject([
      { name: 'Code.gs', text: 'function hello() {}' },
      { name: 'Index.html', text: '<h1>hi</h1>' }
    ]);

    expect(sourceKind).toBe('files');
    expect(project.origin).toBe('local');
    expect(project.scriptId.startsWith('1LOCAL_')).toBe(true);
    expect(project.files.map((f) => f.name)).toEqual(['appsscript', 'Code', 'Index']);
    expect(project.files[0].type).toBe('JSON');
    expect(project.files[1]).toEqual(file('Code', 'SERVER_JS', 'function hello() {}'));
    expect(project.files[2].type).toBe('HTML');
    expect(warnings.join(' ')).toMatch(/appsscript/i);
    expect(project.title).toBe('Импортированный проект');
  });

  it('imports Apps Script content JSON (projects.getContent shape)', async () => {
    const contentJson = buildAppsScriptContentJson(cloudProject);
    const { project, sourceKind } = await importSourcesToProject([
      { name: 'content.json', text: contentJson }
    ]);

    expect(sourceKind).toBe('content-json');
    expect(project.files).toEqual(cloudProject.files);
    expect(project.origin).toBe('local');
  });

  it('imports a bare array of content files', async () => {
    const { project } = await importSourcesToProject([
      {
        name: 'files.json',
        text: JSON.stringify([{ name: 'Code', type: 'SERVER_JS', source: 'function a() {}' }])
      }
    ]);
    expect(project.files).toEqual([
      expect.objectContaining({ name: 'appsscript', type: 'JSON' }),
      file('Code', 'SERVER_JS', 'function a() {}')
    ]);
  });

  it('treats plain JSON files as project JSON files, not as content', async () => {
    const { project } = await importSourcesToProject([
      { name: 'config.json', text: '{"a":1}' },
      { name: 'Code.gs', text: 'function a() {}' }
    ]);
    expect(project.files.map((f) => f.name)).toContain('config');
    expect(project.files.find((f) => f.name === 'config')?.type).toBe('JSON');
  });

  it('imports ZIP archives and uses the archive name as the title', async () => {
    const zip = new JSZip();
    const folder = zip.folder('My_Project')!;
    folder.file('Code.gs', 'function fromZip() {}');
    folder.file('Sidebar.html', '<div/>');
    const bytes = await zip.generateAsync({ type: 'arraybuffer' });

    const { project, sourceKind } = await importSourcesToProject([
      { name: 'My_Project.zip', bytes }
    ]);

    expect(sourceKind).toBe('zip');
    expect(project.files.map((f) => f.name)).toEqual(['appsscript', 'Code', 'Sidebar']);
    expect(project.title).toBe('My Project');
    expect(project.files[1].source).toBe('function fromZip() {}');
  });

  it('ignores metadata/DS_Store noise inside archives', async () => {
    const zip = new JSZip();
    zip.file('project-metadata.json', '{"scriptId":"legacy"}');
    zip.file('__MACOSX/._Code.gs', 'junk');
    zip.file('.DS_Store', 'junk');
    zip.file('Code.gs', 'function a() {}');
    const bytes = await zip.generateAsync({ type: 'arraybuffer' });

    const { project } = await importSourcesToProject([{ name: 'p.zip', bytes }]);
    expect(project.files.map((f) => f.name)).toEqual(['appsscript', 'Code']);
  });

  it('round-trips through a ZIP export', async () => {
    const blob = await projectToZipBlob(cloudProject);
    const bytes = await blob.arrayBuffer();
    const { project } = await importSourcesToProject([{ name: 'Orders_Sync.zip', bytes }]);

    expect(project.files.map((f) => f.name)).toEqual(cloudProject.files.map((f) => f.name));
    expect(project.files.map((f) => f.type)).toEqual(cloudProject.files.map((f) => f.type));
    expect(project.title).toBe('Orders Sync');
  });

  it('keeps the manifest if it is provided', async () => {
    const { warnings } = await importSourcesToProject([
      { name: 'appsscript.json', text: '{"timeZone":"Europe/Amsterdam"}' },
      { name: 'Code.gs', text: 'function a() {}' }
    ]);
    expect(warnings).toEqual([]);
  });
});

describe('import errors', () => {
  it('rejects an empty selection', async () => {
    await expect(importSourcesToProject([])).rejects.toThrow(/ни одного файла/i);
  });

  it('rejects a broken archive', async () => {
    await expect(
      importSourcesToProject([{ name: 'broken.zip', bytes: new Uint8Array([1, 2, 3, 4]) }])
    ).rejects.toThrow(/ZIP/i);
  });

  it('rejects oversized files', async () => {
    await expect(
      importSourcesToProject([{ name: 'Huge.gs', text: 'x'.repeat(MAX_IMPORT_FILE_BYTES + 10) }])
    ).rejects.toThrow(/МБ/i);
  });
});

describe('export payloads', () => {
  it('exposes files with on-disk names', () => {
    expect(projectFileEntries(cloudProject)).toEqual([
      { fileName: 'Code.gs', source: cloudProject.files[0].source },
      { fileName: 'Index.html', source: cloudProject.files[1].source },
      { fileName: 'appsscript.json', source: cloudProject.files[2].source }
    ]);
  });

  it('builds an Apps Script content payload', () => {
    const parsed = JSON.parse(buildAppsScriptContentJson(cloudProject));
    expect(parsed.scriptId).toBe(cloudProject.scriptId);
    expect(parsed.files).toHaveLength(3);
    expect(Object.keys(parsed.files[0]).sort()).toEqual(['name', 'source', 'type']);
  });

  it('includes metadata in the ZIP export', async () => {
    const blob = await projectToZipBlob(cloudProject, '2026-10-07T00:00:00.000Z');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const meta = await zip.file('Orders_Sync/project-metadata.json')!.async('string');
    expect(JSON.parse(meta)).toMatchObject({
      scriptId: cloudProject.scriptId,
      origin: 'cloud',
      exportedAt: '2026-10-07T00:00:00.000Z',
      filesCount: 3
    });
  });
});
