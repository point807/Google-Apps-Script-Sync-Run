/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listVersions,
  createVersion,
  createDeployment,
  updateDeploymentVersion,
  isApiExecutable,
  ScriptDeployment
} from './appsScriptService';

const okJson = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data)
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deployments API', () => {
  it('listVersions parses the versions list', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ versions: [{ versionNumber: 3, description: 'x' }] }));
    const versions = await listVersions('tok', 'script-123');
    expect(versions).toEqual([{ versionNumber: 3, description: 'x' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/projects/script-123/versions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('listVersions throws with detail on failure', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'forbidden' });
    await expect(listVersions('tok', 'script-123')).rejects.toThrow(/403/);
  });

  it('createVersion posts the description', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ versionNumber: 4, description: 'my ver' }));
    const v = await createVersion('tok', 'script-123', 'my ver');
    expect(v.versionNumber).toBe(4);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ description: 'my ver' });
  });

  it('createDeployment includes manifest name and optional version', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ deploymentId: 'd1' }));
    await createDeployment('tok', 'script-123', 'prod', 4);
    let body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toEqual({ description: 'prod', manifestFileName: 'appsscript', versionNumber: 4 });

    fetchMock.mockResolvedValueOnce(okJson({ deploymentId: 'd2' }));
    await createDeployment('tok', 'script-123', 'head-based');
    body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(body.versionNumber).toBeUndefined();
    expect(body.manifestFileName).toBe('appsscript');
  });

  it('updateDeploymentVersion sends updateMask', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ deploymentId: 'd1' }));
    await updateDeploymentVersion('tok', 'script-123', 'd1', 7);
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('PUT');
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.updateMask).toBe('deploymentConfig.versionNumber');
    expect(body.deploymentConfig.versionNumber).toBe(7);
  });

  it('isApiExecutable detects EXECUTION_API entry points', () => {
    const exec: ScriptDeployment = {
      deploymentId: 'a',
      entryPoints: [{ entryPointType: 'EXECUTION_API', executionApi: { entryPointConfig: {} } }]
    };
    const web: ScriptDeployment = {
      deploymentId: 'b',
      entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: 'x' } }]
    };
    const none: ScriptDeployment = { deploymentId: 'c' };
    expect(isApiExecutable(exec)).toBe(true);
    expect(isApiExecutable(web)).toBe(false);
    expect(isApiExecutable(none)).toBe(false);
  });
});
