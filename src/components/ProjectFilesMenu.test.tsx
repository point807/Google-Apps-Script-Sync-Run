/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { act } from 'react';
import { type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppsScriptProject } from '../types';

// firebaseAuth throws without VITE_FIREBASE_* env vars and needs real network.
vi.mock('../services/firebaseAuth', () => ({
  initAuth: () => () => {},
  googleSignIn: async () => null,
  logout: async () => {}
}));

const { useAppStore } = await import('../store/appStore');
const { ProjectImportButton, ProjectFilesMenu } = await import('./ProjectFilesMenu');
const { ProjectToolbar } = await import('./ProjectToolbar');

// Client rendering (not renderToString): zustand serves its *initial* state to
// the server snapshot, which would hide store-driven UI in these tests.
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mounts: HTMLElement[] = [];

const mount = (node: ReactNode): HTMLElement => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mounts.push(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  (container as HTMLElement & { __root?: unknown }).__root = root;
  return container;
};

const render = (node: ReactNode): string => {
  const container = mount(node);
  const html = container.innerHTML;
  act(() => {
    (
      (container as HTMLElement & { __root?: { unmount(): void } }).__root as {
        unmount(): void;
      }
    ).unmount();
  });
  return html;
};

const cloudProject: AppsScriptProject = {
  scriptId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456',
  title: 'Orders Sync',
  origin: 'cloud',
  files: [{ name: 'Code', type: 'SERVER_JS', source: 'function a() {}' }]
};

const localProject: AppsScriptProject = {
  ...cloudProject,
  scriptId: '1LOCAL_abc1234567',
  title: 'Imported from files',
  origin: 'local'
};

const setProject = (project: AppsScriptProject) =>
  useAppStore.setState({ currentProject: project, allProjects: [project], lang: 'ru' });

const toolbar = (project: AppsScriptProject) => (
  <ProjectToolbar
    project={project}
    totalChangedCount={0}
    boundToLabel="Привязано к таблице:"
    isPushing={false}
    isSavingEverywhere={false}
    onPushToGoogle={() => {}}
    onSaveToGitHub={() => {}}
    onSaveEverywhere={() => {}}
    onCreateCommit={() => {}}
  />
);

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ logs: [], toasts: [] });
});

afterEach(() => {
  mounts.splice(0).forEach((container) => container.remove());
});

describe('ProjectFilesMenu', () => {
  it('renders the export/import entry point with an import input', () => {
    setProject(cloudProject);
    const html = render(<ProjectFilesMenu project={cloudProject} />);

    expect(html).toContain('Файлы');
    expect(html).toContain('type="file"');
    expect(html).toContain('.zip,.json,.gs,.js,.html,.htm,.txt');
  });

  it('is wired into the project toolbar next to the other actions', () => {
    setProject(cloudProject);
    const html = render(toolbar(cloudProject));

    expect(html).toContain('В Google');
    expect(html).toContain('Файлы');
  });
});

describe('ProjectImportButton', () => {
  it('renders the empty-state import button', () => {
    setProject(cloudProject);
    const html = render(<ProjectImportButton />);

    expect(html).toContain('Импортировать скрипт из файлов');
    expect(html).toContain('type="file"');
  });
});

describe('import from the UI', () => {
  it('turns picked files into a project in the store', async () => {
    useAppStore.setState({ currentProject: null, allProjects: [], lang: 'ru' });
    const container = mount(<ProjectImportButton />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(['function fromUi() { return 1; }'], 'Code.gs', { type: 'text/plain' }),
      new File(['<!DOCTYPE html><html></html>'], 'Index.html', { type: 'text/plain' })
    ];
    Object.defineProperty(input, 'files', { value: files, configurable: true });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const project = useAppStore.getState().currentProject;
    expect(project).toBeTruthy();
    expect(project!.origin).toBe('local');
    expect(project!.files.map((f) => f.name)).toEqual(['appsscript', 'Code', 'Index']);
    expect(useAppStore.getState().allProjects).toHaveLength(1);
    // The manifest warning is surfaced to the user.
    expect(useAppStore.getState().toasts.length).toBeGreaterThan(0);
  });
});

describe('bind Script ID affordance', () => {
  it('offers binding for projects imported from files', () => {
    setProject(localProject);
    expect(render(toolbar(localProject))).toContain('привязать Script ID');
  });

  it('is hidden for cloud projects', () => {
    setProject(cloudProject);
    expect(render(toolbar(cloudProject))).not.toContain('привязать Script ID');
  });

  it('binds the imported project to a real Script ID through the modal', async () => {
    setProject(localProject);
    const container = mount(toolbar(localProject));

    const chip = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('привязать Script ID')
    );
    expect(chip).toBeTruthy();

    await act(async () => {
      chip!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = container.querySelector(
      'input[placeholder*="script.google.com"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(
        input,
        'https://script.google.com/home/projects/1ZzYyXxWwVvUuTtSsRrQqPpOo9999999/edit'
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const bound = useAppStore.getState().currentProject;
    expect(bound?.scriptId).toBe('1ZzYyXxWwVvUuTtSsRrQqPpOo9999999');
    expect(bound?.origin).toBe('cloud');
  });
});
