/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  RefreshCw,
  PackagePlus,
  UploadCloud,
  FileJson,
  Check,
  ExternalLink
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import { AppsScriptProject } from '../types';
import {
  listVersions,
  createVersion,
  listDeployments,
  createDeployment,
  updateDeploymentVersion,
  isApiExecutable,
  ScriptVersion,
  ScriptDeployment,
  updateAppsScriptProject
} from '../services/appsScriptService';

export interface DeploymentManagerProps {
  open: boolean;
  onClose: () => void;
}

/** Versions & deployments UI: makes scripts.run work (API-executable deployment). */
export const DeploymentManager: React.FC<DeploymentManagerProps> = ({ open, onClose }) => {
  const currentProject = useAppStore((s) => s.currentProject);
  const accessToken = useAppStore((s) => s.accessToken);
  const onUpdateProject = useAppStore((s) => s.updateProject);
  const addLog = useAppStore((s) => s.addLog);
  const onLog = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') =>
    addLog(msg, type ?? 'info', 'apps_script');
  const t = useT('deploy');

  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [deployments, setDeployments] = useState<ScriptDeployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [versionDesc, setVersionDesc] = useState('');
  const [deploymentDesc, setDeploymentDesc] = useState('');
  const [deploymentVersion, setDeploymentVersion] = useState<string>('head');
  const [updateChoice, setUpdateChoice] = useState<Record<string, string>>({});

  const project = currentProject;
  const canUseApi = !!accessToken && !!project && !project.scriptId.startsWith('1DEMO_');

  const refresh = useCallback(async () => {
    if (!accessToken || !project || project.scriptId.startsWith('1DEMO_')) return;
    setLoading(true);
    try {
      const [v, d] = await Promise.all([
        listVersions(accessToken, project.scriptId),
        listDeployments(accessToken, project.scriptId)
      ]);
      setVersions(v);
      setDeployments(d);
    } catch (err: any) {
      onLog(`Ошибка загрузки версий/деплоев: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, project?.scriptId]);

  useEffect(() => {
    if (open) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCreateVersion = async () => {
    if (!accessToken || !project) return;
    setBusy(true);
    try {
      const created = await createVersion(
        accessToken,
        project.scriptId,
        versionDesc.trim() || `Version ${new Date().toLocaleString()}`
      );
      onLog(`Создана версия ${created.versionNumber} «${created.description}»`, 'success');
      setVersionDesc('');
      await refresh();
    } catch (err: any) {
      onLog(`Ошибка создания версии: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDeployment = async () => {
    if (!accessToken || !project) return;
    setBusy(true);
    try {
      const versionNumber = deploymentVersion === 'head' ? undefined : Number(deploymentVersion);
      const created = await createDeployment(
        accessToken,
        project.scriptId,
        deploymentDesc.trim() || `Deployment ${new Date().toLocaleString()}`,
        versionNumber
      );
      onLog(`Создан деплой ${created.deploymentId.slice(0, 12)}...`, 'success');
      setDeploymentDesc('');
      await refresh();
    } catch (err: any) {
      onLog(`Ошибка создания деплоя: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateDeployment = async (deploymentId: string) => {
    if (!accessToken || !project) return;
    const choice = updateChoice[deploymentId];
    if (!choice) return;
    setBusy(true);
    try {
      await updateDeploymentVersion(accessToken, project.scriptId, deploymentId, Number(choice));
      onLog(`Деплой ${deploymentId.slice(0, 12)}... обновлён до версии ${choice}`, 'success');
      await refresh();
    } catch (err: any) {
      onLog(`Ошибка обновления деплоя: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleEnsureManifest = async () => {
    const proj: AppsScriptProject | null = project;
    if (!proj) return;
    const manifestFile = proj.files.find((f) => f.name === 'appsscript');
    if (!manifestFile) {
      alert('Файл appsscript (манифест) не найден в проекте.');
      return;
    }
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(manifestFile.source || '{}');
    } catch {
      alert('Манифест appsscript содержит некорректный JSON — исправьте его вручную.');
      return;
    }
    if (manifest.executionApi) {
      onLog('Манифест уже содержит executionApi — менять ничего не нужно', 'info');
      return;
    }
    manifest.executionApi = { access: 'MYSELF' };
    const newSource = JSON.stringify(manifest, null, 2);
    const updatedFiles = proj.files.map((f) =>
      f.name === 'appsscript' ? { ...f, source: newSource } : f
    );
    const updated: AppsScriptProject = {
      ...proj,
      files: updatedFiles,
      lastModified: new Date().toISOString()
    };
    onUpdateProject(updated);
    if (accessToken && !proj.scriptId.startsWith('1DEMO_')) {
      try {
        await updateAppsScriptProject(proj.scriptId, updatedFiles, accessToken);
        onLog('executionApi добавлен в манифест и сохранён в Apps Script', 'success');
      } catch (err: any) {
        onLog(
          `Манифест обновлён локально, но не сохранён в Apps Script: ${err.message}`,
          'warning'
        );
      }
    } else {
      onLog('executionApi добавлен в манифест (локально)', 'success');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[88vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Rocket className="w-5 h-5 text-indigo-400 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-white">{t.title}</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">{t.desc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
          >
            {t.close}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Manifest */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <FileJson className="w-4 h-4 text-amber-400" />
                {t.manifestTitle}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEnsureManifest}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {t.manifestBtn}
                </button>
                <a
                  href={`https://script.google.com/home/projects/${project?.scriptId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-400 hover:text-indigo-400 transition flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Apps Script Editor
                </a>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{t.manifestHint}</p>
          </div>

          {/* Versions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t.versionsTitle}
              </h4>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
                title={t.refresh}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={versionDesc}
                onChange={(e) => setVersionDesc(e.target.value)}
                placeholder={t.versionDescPlaceholder}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                type="button"
                onClick={handleCreateVersion}
                disabled={busy || !canUseApi}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                {t.createVersionBtn}
              </button>
            </div>

            <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl bg-slate-950/60 overflow-hidden font-mono text-xs">
              {versions.length === 0 ? (
                <div className="p-4 text-slate-500">{t.noVersions}</div>
              ) : (
                versions.map((v) => (
                  <div
                    key={v.versionNumber}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <span className="text-indigo-300 font-bold">v{v.versionNumber}</span>
                    <span className="text-slate-300 flex-1 truncate">{v.description}</span>
                    <span className="text-slate-500 text-[10px] shrink-0">
                      {v.createTime ? new Date(v.createTime).toLocaleString() : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Deployments */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {t.deploymentsTitle}
            </h4>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={deploymentDesc}
                onChange={(e) => setDeploymentDesc(e.target.value)}
                placeholder={t.deploymentDescPlaceholder}
                className="flex-1 min-w-40 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
              <select
                value={deploymentVersion}
                onChange={(e) => setDeploymentVersion(e.target.value)}
                className="px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
              >
                <option value="head">{t.headOption}</option>
                {versions.map((v) => (
                  <option key={v.versionNumber} value={v.versionNumber}>
                    v{v.versionNumber} — {v.description}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateDeployment}
                disabled={busy || !canUseApi}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                {t.createDeploymentBtn}
              </button>
            </div>

            <div className="space-y-2">
              {deployments.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 border border-slate-800/80 rounded-xl bg-slate-950/60">
                  {t.noDeployments}
                </div>
              ) : (
                deployments.map((d) => (
                  <div
                    key={d.deploymentId}
                    className="p-3 border border-slate-800/80 rounded-xl bg-slate-950/60 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 font-mono text-xs min-w-0">
                        <span className="text-slate-200 font-semibold truncate">
                          {d.deploymentConfig?.description || t.untitledDeployment}
                        </span>
                        <span className="text-slate-500 text-[10px] shrink-0">
                          {d.deploymentId.slice(0, 10)}...
                        </span>
                        {d.deploymentConfig?.versionNumber && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px]">
                            v{d.deploymentConfig.versionNumber}
                          </span>
                        )}
                        {isApiExecutable(d) ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            {t.apiExecutable}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px]">
                            {t.notExecutable}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={updateChoice[d.deploymentId] || ''}
                          onChange={(e) =>
                            setUpdateChoice((c) => ({ ...c, [d.deploymentId]: e.target.value }))
                          }
                          className="px-2 py-1 text-[11px] bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                        >
                          <option value="">{t.versionLabel}</option>
                          {versions.map((v) => (
                            <option key={v.versionNumber} value={v.versionNumber}>
                              v{v.versionNumber}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleUpdateDeployment(d.deploymentId)}
                          disabled={busy || !updateChoice[d.deploymentId]}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer disabled:opacity-40"
                        >
                          {t.updateBtn}
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {t.updated}: {d.updateTime ? new Date(d.updateTime).toLocaleString() : '—'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
