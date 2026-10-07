/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Plus,
  RefreshCw,
  Trash2,
  ArrowRight,
  Check,
  List,
  Lock,
  Network
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import {
  createBranch,
  deleteBranch,
  listBranches,
  compareBranches,
  GitHubBranch,
  BranchComparison
} from '../services/githubService';
import { BranchTreeMap } from './BranchTreeMap';
import { ConfirmationModal } from './ConfirmationModal';

export interface BranchManagerProps {
  /** Default branch of the repository, when known from the repo list. */
  defaultBranch?: string;
}

/** Repository branch management: tree/table view, create, switch and delete branches. */
export const BranchManager: React.FC<BranchManagerProps> = ({ defaultBranch }) => {
  const gitHubConfig = useAppStore((s) => s.gitHubConfig);
  const onUpdateConfig = useAppStore((s) => s.updateGitHubConfig);
  const addLog = useAppStore((s) => s.addLog);
  const lang = useAppStore((s) => s.lang);
  const onLog = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') =>
    addLog(msg, type ?? 'info', 'github');
  const t = useT('github');

  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branchViewMode, setBranchViewMode] = useState<'tree' | 'table'>('tree');
  const [comparisons, setComparisons] = useState<Record<string, BranchComparison>>({});
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState(gitHubConfig.branch || 'main');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [, setIsDeletingBranch] = useState(false);

  async function loadBranchesList() {
    if (!gitHubConfig.token || !gitHubConfig.owner || !gitHubConfig.repo) return;
    setLoadingBranches(true);
    try {
      const branchList = await listBranches(
        gitHubConfig.token,
        gitHubConfig.owner,
        gitHubConfig.repo
      );
      setBranches(branchList);

      // Determine default branch (main or master or first)
      const defaultBrName =
        defaultBranch ||
        (branchList.some((b) => b.name === 'main') ? 'main' : branchList[0]?.name || 'main');

      // Ensure active branch exists in list, otherwise select first
      if (branchList.length > 0 && !branchList.some((b) => b.name === gitHubConfig.branch)) {
        onUpdateConfig({
          ...gitHubConfig,
          branch: branchList[0].name
        });
      }

      // Fetch comparisons asynchronously
      const compMap: Record<string, BranchComparison> = {};
      for (const b of branchList) {
        if (b.name !== defaultBrName) {
          try {
            const cmp = await compareBranches(
              gitHubConfig.token,
              gitHubConfig.owner,
              gitHubConfig.repo,
              defaultBrName,
              b.name
            );
            if (cmp) {
              compMap[b.name] = cmp;
            }
          } catch {
            // ignore comparison errors
          }
        }
      }
      setComparisons(compMap);
    } catch (e: any) {
      console.warn('Failed to load branches', e);
    } finally {
      setLoadingBranches(false);
    }
  }

  // Branch operations: Switch, Create, Delete
  const handleSwitchBranch = (branchName: string) => {
    onUpdateConfig({
      ...gitHubConfig,
      branch: branchName
    });
    onLog(`Активная ветка переключена на: ${branchName}`, 'info');
  };

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || !gitHubConfig.token || !gitHubConfig.owner || !gitHubConfig.repo)
      return;

    setIsCreatingBranch(true);
    try {
      const cleanName = newBranchName.trim().replace(/\s+/g, '-');
      onLog(`Создание ветки "${cleanName}" из "${baseBranch}"...`, 'info');

      await createBranch(
        gitHubConfig.token,
        gitHubConfig.owner,
        gitHubConfig.repo,
        cleanName,
        baseBranch
      );

      onLog(`Ветка "${cleanName}" успешно создана на GitHub!`, 'success');
      setShowCreateBranchModal(false);
      setNewBranchName('');

      // Refresh and switch to newly created branch
      await loadBranchesList();
      handleSwitchBranch(cleanName);
    } catch (err: any) {
      onLog(`Ошибка создания ветки: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const handleConfirmDeleteBranch = async () => {
    if (!branchToDelete || !gitHubConfig.token || !gitHubConfig.owner || !gitHubConfig.repo) return;

    setIsDeletingBranch(true);
    try {
      onLog(`Удаление ветки "${branchToDelete}" с GitHub...`, 'warning');
      await deleteBranch(gitHubConfig.token, gitHubConfig.owner, gitHubConfig.repo, branchToDelete);

      onLog(`Ветка "${branchToDelete}" удалена`, 'success');
      setBranchToDelete(null);
      await loadBranchesList();
    } catch (err: any) {
      onLog(`Ошибка удаления ветки: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setIsDeletingBranch(false);
    }
  };

  useEffect(() => {
    if (gitHubConfig.connected && gitHubConfig.owner && gitHubConfig.repo) {
      loadBranchesList();
    }
  }, [gitHubConfig.owner, gitHubConfig.repo]);

  return (
    <>
      {/* Branch Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-purple-400" />
              <span>{t.branchSectionTitle}</span>
            </h3>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>{t.activeBranchLabel}</span>
              <span className="font-mono font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {gitHubConfig.branch || 'main'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Tree vs List */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setBranchViewMode('tree')}
                className={`px-2.5 py-1 text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  branchViewMode === 'tree'
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Схема веток</span>
              </button>
              <button
                type="button"
                onClick={() => setBranchViewMode('table')}
                className={`px-2.5 py-1 text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  branchViewMode === 'table'
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Список</span>
              </button>
            </div>

            <button
              type="button"
              onClick={loadBranchesList}
              disabled={loadingBranches}
              className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
              title={t.refreshBranches}
            >
              <RefreshCw className={`w-4 h-4 ${loadingBranches ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setBaseBranch(gitHubConfig.branch || 'main');
                setShowCreateBranchModal(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.createBranchBtn}</span>
            </button>
          </div>
        </div>

        {/* Branches Display: Tree Map or Table */}
        {loadingBranches ? (
          <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            <span>Загрузка веток с GitHub...</span>
          </div>
        ) : branches.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 font-mono bg-slate-950/40 rounded-xl">
            Ветки не найдены. Создайте ветку выше.
          </div>
        ) : branchViewMode === 'tree' ? (
          <BranchTreeMap
            branches={branches}
            activeBranch={gitHubConfig.branch || 'main'}
            defaultBranch={defaultBranch || 'main'}
            repoOwner={gitHubConfig.owner}
            repoName={gitHubConfig.repo}
            comparisons={comparisons}
            onSwitchBranch={handleSwitchBranch}
            onCreateFromBranch={(base) => {
              setBaseBranch(base);
              setShowCreateBranchModal(true);
            }}
            onDeleteBranch={(name) => setBranchToDelete(name)}
            lang={lang}
          />
        ) : (
          <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl bg-slate-950/70 overflow-hidden font-mono text-xs">
            {branches.map((b) => {
              const isActive = gitHubConfig.branch === b.name;
              const isDefault = b.name === 'main' || b.name === 'master';

              return (
                <div
                  key={b.name}
                  className={`p-3.5 flex items-center justify-between gap-3 transition ${
                    isActive ? 'bg-purple-950/20' : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GitBranch
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-purple-400' : 'text-slate-500'
                      }`}
                    />
                    <span
                      className={`font-semibold truncate ${
                        isActive ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {b.name}
                    </span>

                    {isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Активная
                      </span>
                    )}

                    {isDefault && (
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}

                    {b.protected && (
                      <span
                        title="Protected branch"
                        className="text-amber-400 flex items-center gap-0.5 text-[10px]"
                      >
                        <Lock className="w-3 h-3" />
                      </span>
                    )}

                    {b.commit?.sha && (
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        ({b.commit.sha.slice(0, 7)})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isActive ? (
                      <button
                        type="button"
                        onClick={() => handleSwitchBranch(b.name)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>{t.switchBranchBtn}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-sans">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="hidden sm:inline">Выбрана</span>
                      </span>
                    )}

                    {/* Delete button (cannot delete active or default branch) */}
                    {!isActive && !isDefault && !b.protected && (
                      <button
                        type="button"
                        onClick={() => setBranchToDelete(b.name)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded transition cursor-pointer"
                        title={t.deleteBranchBtn}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sync & Auto-push Actions */}
      {/* Modal: Create Branch */}
      {showCreateBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-200 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-purple-400" />
              <span>{t.createBranchModalTitle}</span>
            </h3>

            <form onSubmit={handleCreateBranchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Название новой ветки
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder={t.branchNamePlaceholder}
                  autoFocus
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t.baseBranchLabel}
                </label>
                <select
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBranchModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBranch || !newBranchName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingBranch ? 'Создание...' : t.createBranchAction}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Repo */}
      {/* Confirmation Modal for Branch Deletion */}
      <ConfirmationModal
        isOpen={!!branchToDelete}
        title={t.deleteBranchConfirmTitle}
        message={
          branchToDelete
            ? t.deleteBranchConfirmDesc(
                branchToDelete,
                `${gitHubConfig.owner}/${gitHubConfig.repo}`
              )
            : ''
        }
        isDestructive={true}
        confirmLabel="Да, удалить ветку"
        cancelLabel="Отмена"
        details={
          branchToDelete
            ? [
                `Репозиторий: ${gitHubConfig.owner}/${gitHubConfig.repo}`,
                `Ветка: ${branchToDelete}`,
                `Внимание: все коммиты, существующие только в этой ветке, станут недоступны`
              ]
            : []
        }
        onConfirm={handleConfirmDeleteBranch}
        onCancel={() => setBranchToDelete(null)}
      />
    </>
  );
};
