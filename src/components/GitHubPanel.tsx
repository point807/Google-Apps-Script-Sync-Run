import React, { useState, useEffect } from 'react';
import {
  Github,
  Key,
  FolderGit2,
  UploadCloud,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  GitBranch,
  Lock,
  HelpCircle,
  Clock,
  Trash2,
  Check,
  ArrowRight,
  Network,
  List,
  X
} from 'lucide-react';
import { AppsScriptProject, GitHubConfig, SavedGitHubToken } from '../types';
import {
  validateGitHubToken,
  listRepositories,
  createRepository,
  pushFilesToGitHub,
  fetchRemoteCommits,
  listBranches,
  createBranch,
  deleteBranch,
  compareBranches,
  BranchComparison,
  GitHubUser,
  GitHubRepo,
  GitHubBranch,
  RemoteCommitInfo
} from '../services/githubService';
import { ConfirmationModal } from './ConfirmationModal';
import { BranchTreeMap } from './BranchTreeMap';

interface GitHubPanelProps {
  project: AppsScriptProject | null;
  gitHubConfig: GitHubConfig;
  onUpdateConfig: (cfg: GitHubConfig) => void;
  lang: 'ru' | 'en';
  onLog: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const GitHubPanel: React.FC<GitHubPanelProps> = ({
  project,
  gitHubConfig,
  onUpdateConfig,
  lang,
  onLog
}) => {
  const [tokenInput, setTokenInput] = useState(gitHubConfig.token || '');
  const [validating, setValidating] = useState(false);
  const [gitUser, setGitUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [, setLoadingRepos] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [remoteCommits, setRemoteCommits] = useState<RemoteCommitInfo[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  // Saved Tokens / Multi-account Management
  const [savedTokens, setSavedTokens] = useState<SavedGitHubToken[]>(() => {
    try {
      const stored = localStorage.getItem('scriptvault_saved_github_tokens');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    if (gitHubConfig.token) {
      return [
        {
          id: 'token-initial',
          name: gitHubConfig.owner ? `@${gitHubConfig.owner}` : 'Активный ключ',
          token: gitHubConfig.token,
          username: gitHubConfig.owner,
          addedAt: Date.now()
        }
      ];
    }
    return [];
  });
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newTokenInput, setNewTokenInput] = useState('');
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [switchingToken, setSwitchingToken] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<SavedGitHubToken | null>(null);

  // Branch management state
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

  // Create repo modal
  const [showCreateRepoModal, setShowCreateRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [creatingRepo, setCreatingRepo] = useState(false);

  const t = {
    ru: {
      title: 'Интеграция с GitHub',
      subtitle:
        'Подключение удаленного репозитория GitHub, управление ветками, синхронизация и резервное копирование',
      tokenLabel: 'GitHub Personal Access Token (PAT):',
      tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxx',
      connectBtn: 'Подключить GitHub',
      disconnectBtn: 'Отключить',
      connectedAs: 'Подключен как:',
      tokenHelp:
        'Для работы требуется токен с разрешением "repo". Создайте его на GitHub: Settings → Developer Settings → Personal access tokens (classic) → Generate token (выберите scope: repo).',
      repoSection: 'Настройки репозитория GitHub',
      selectRepo: 'Выберите репозиторий:',
      createRepoBtn: 'Создать новый репозиторий',
      branchSectionTitle: 'Управление ветками репозитория (Branches)',
      activeBranchLabel: 'Текущая активная ветка:',
      createBranchBtn: 'Создать новую ветку',
      refreshBranches: 'Обновить ветки',
      switchBranchBtn: 'Переключить',
      deleteBranchBtn: 'Удалить ветку',
      pathLabel: 'Папка в репозитории (оставьте пустым для корня):',
      autoPushToggle: 'Автоматически отправлять в GitHub при каждой резервной копии',
      pushNowBtn: 'Отправить текущий код в GitHub',
      pushing: 'Отправка на GitHub...',
      recentCommitsTitle: 'Последние коммиты в репозитории GitHub:',
      noRemoteCommits: 'Нет истории коммитов или репозиторий еще не инициализирован.',
      refreshCommits: 'Обновить историю',
      createModalTitle: 'Создание нового репозитория на GitHub',
      repoNamePlaceholder: 'my-apps-script-project',
      privateOption: 'Приватный репозиторий (рекомендуется)',
      createBtn: 'Создать',
      cancel: 'Отмена',
      createBranchModalTitle: 'Создание новой ветки на GitHub',
      branchNamePlaceholder: 'feature/sheet-sync или v1.1',
      baseBranchLabel: 'Создать ответвление от:',
      createBranchAction: 'Создать ветку',
      deleteBranchConfirmTitle: 'Удалить ветку на GitHub?',
      deleteBranchConfirmDesc: (branch: string) =>
        `Вы уверены, что хотите удалить ветку "${branch}" из репозитория ${gitHubConfig.owner}/${gitHubConfig.repo}? Это действие нельзя отменить.`,
      cannotDeleteActive: 'Нельзя удалить активную или защищенную ветку'
    },
    en: {
      title: 'GitHub Integration',
      subtitle: 'Connect remote GitHub repository, manage branches, sync, and backup code',
      tokenLabel: 'GitHub Personal Access Token (PAT):',
      tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxx',
      connectBtn: 'Connect GitHub',
      disconnectBtn: 'Disconnect',
      connectedAs: 'Connected as:',
      tokenHelp:
        'Requires a token with "repo" scope. Generate one at: GitHub → Settings → Developer Settings → Personal access tokens → Generate new token (classic).',
      repoSection: 'GitHub Repository Settings',
      selectRepo: 'Select target repository:',
      createRepoBtn: 'Create New Repository',
      branchSectionTitle: 'Repository Branch Management',
      activeBranchLabel: 'Active branch for sync:',
      createBranchBtn: 'New Branch',
      refreshBranches: 'Refresh branches',
      switchBranchBtn: 'Switch',
      deleteBranchBtn: 'Delete branch',
      pathLabel: 'Folder path (leave empty for root):',
      autoPushToggle: 'Automatically push to GitHub on every backup snapshot',
      pushNowBtn: 'Push Current Code to GitHub',
      pushing: 'Pushing to GitHub...',
      recentCommitsTitle: 'Recent commits on remote GitHub repository:',
      noRemoteCommits: 'No remote commit history found or repository is empty.',
      refreshCommits: 'Refresh remote commits',
      createModalTitle: 'Create New GitHub Repository',
      repoNamePlaceholder: 'my-apps-script-project',
      privateOption: 'Private repository (recommended)',
      createBtn: 'Create Repository',
      cancel: 'Cancel',
      createBranchModalTitle: 'Create New Branch on GitHub',
      branchNamePlaceholder: 'feature/sheet-sync or v1.1',
      baseBranchLabel: 'Branch from base:',
      createBranchAction: 'Create Branch',
      deleteBranchConfirmTitle: 'Delete branch on GitHub?',
      deleteBranchConfirmDesc: (branch: string) =>
        `Are you sure you want to delete branch "${branch}" in repository ${gitHubConfig.owner}/${gitHubConfig.repo}? This action cannot be undone.`,
      cannotDeleteActive: 'Cannot delete active or protected branch'
    }
  }[lang];

  // Validate token on mount if present
  useEffect(() => {
    if (gitHubConfig.token && !gitUser) {
      handleValidate(gitHubConfig.token, '', false);
    }
  }, [gitHubConfig.token]);

  // Load branches and commits when repo changes
  useEffect(() => {
    if (gitHubConfig.connected && gitHubConfig.owner && gitHubConfig.repo) {
      loadBranchesList();
      loadRemoteCommitsList();
    }
  }, [gitHubConfig.owner, gitHubConfig.repo]);

  // Reload commits when branch changes
  useEffect(() => {
    if (gitHubConfig.connected && gitHubConfig.owner && gitHubConfig.repo && gitHubConfig.branch) {
      loadRemoteCommitsList();
    }
  }, [gitHubConfig.branch]);

  const maskToken = (tok: string) => {
    if (!tok) return '';
    const clean = tok.trim();
    if (clean.length <= 8) return '••••••••';
    const prefix = clean.slice(0, 4);
    const suffix = clean.slice(-4);
    return `${prefix}••••••••${suffix}`;
  };

  async function handleValidate(token: string, customLabel = '', logSuccess = true) {
    if (!token.trim()) return;
    setValidating(true);
    try {
      const cleanToken = token.trim();
      const user = await validateGitHubToken(cleanToken);
      setGitUser(user);

      // Save/update in savedTokens
      const label = customLabel.trim() || `@${user.login}`;
      setSavedTokens((prev) => {
        const existingIdx = prev.findIndex((item) => item.token === cleanToken);
        const entry: SavedGitHubToken = {
          id: existingIdx >= 0 ? prev[existingIdx].id : `token-${Date.now()}`,
          name: label,
          token: cleanToken,
          username: user.login,
          avatarUrl: user.avatar_url,
          addedAt: Date.now()
        };
        const updated =
          existingIdx >= 0
            ? prev.map((item, idx) => (idx === existingIdx ? entry : item))
            : [entry, ...prev];
        try {
          localStorage.setItem('scriptvault_saved_github_tokens', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      // Load repos for this token
      setLoadingRepos(true);
      const list = await listRepositories(cleanToken);
      setRepos(list);

      // Default to first repo if none or if switching accounts
      const hasMatchingRepo = list.some((r) => r.name === gitHubConfig.repo);
      const selectedRepo = hasMatchingRepo
        ? list.find((r) => r.name === gitHubConfig.repo)!
        : list[0];

      onUpdateConfig({
        token: cleanToken,
        connected: true,
        owner: selectedRepo ? selectedRepo.full_name.split('/')[0] : user.login,
        repo: selectedRepo ? selectedRepo.name : '',
        branch: selectedRepo?.default_branch || 'main',
        path: gitHubConfig.path || '',
        autoPush: gitHubConfig.autoPush ?? true
      });

      if (logSuccess) onLog(`GitHub подключен к аккаунту: @${user.login}`, 'success');
      setShowTokenModal(false);
      setNewTokenInput('');
      setNewTokenLabel('');
      setTokenInput('');
    } catch (err: any) {
      onLog(`Ошибка подключения GitHub: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setValidating(false);
      setLoadingRepos(false);
    }
  }

  const handleSelectSavedToken = async (saved: SavedGitHubToken) => {
    if (!saved.token) return;
    setSwitchingToken(true);
    try {
      await handleValidate(saved.token, saved.name, true);
    } catch (e: any) {
      alert(`Не удалось подключить токен: ${e.message}`);
    } finally {
      setSwitchingToken(false);
    }
  };

  const promptDeleteToken = (tok: SavedGitHubToken) => {
    setTokenToDelete(tok);
  };

  const confirmDeleteToken = (tokenId: string) => {
    const toDelete = savedTokens.find((t) => t.id === tokenId);
    if (!toDelete) return;

    const updated = savedTokens.filter((t) => t.id !== tokenId);
    setSavedTokens(updated);
    try {
      localStorage.setItem('scriptvault_saved_github_tokens', JSON.stringify(updated));
    } catch {
      // ignore
    }

    if (gitHubConfig.token === toDelete.token) {
      handleDisconnect();
    }
    onLog(`Ключ "${toDelete.name}" удален`, 'info');
  };

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
        repos.find((r) => r.name === gitHubConfig.repo)?.default_branch ||
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

  async function loadRemoteCommitsList() {
    if (!gitHubConfig.token || !gitHubConfig.owner || !gitHubConfig.repo) return;
    setLoadingCommits(true);
    try {
      const commits = await fetchRemoteCommits(
        gitHubConfig.token,
        gitHubConfig.owner,
        gitHubConfig.repo,
        gitHubConfig.branch || 'main'
      );
      setRemoteCommits(commits);
    } catch (e) {
      console.warn('Failed to load remote commits', e);
    } finally {
      setLoadingCommits(false);
    }
  }

  const handleDisconnect = () => {
    onUpdateConfig({
      token: '',
      owner: '',
      repo: '',
      branch: 'main',
      path: '',
      autoPush: false,
      connected: false
    });
    setGitUser(null);
    setRepos([]);
    setBranches([]);
    setRemoteCommits([]);
    onLog('GitHub отключен', 'info');
  };

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

  const handlePushCurrentCode = async () => {
    if (!project) {
      alert(
        lang === 'ru'
          ? 'Сначала подключите проект Apps Script.'
          : 'Connect an Apps Script project first.'
      );
      return;
    }
    if (!gitHubConfig.token || !gitHubConfig.owner || !gitHubConfig.repo) {
      alert('Пожалуйста, выберите репозиторий GitHub.');
      return;
    }

    setPushing(true);
    try {
      onLog(
        `Отправка ${project.files.length} файлов в ветку "${gitHubConfig.branch}" (${gitHubConfig.owner}/${gitHubConfig.repo})...`,
        'info'
      );
      const result = await pushFilesToGitHub(
        gitHubConfig.token,
        gitHubConfig.owner,
        gitHubConfig.repo,
        gitHubConfig.branch || 'main',
        project.files,
        `Deploy: update ${project.title} (${new Date().toLocaleString()}) [ScriptVault]`,
        gitHubConfig.path || ''
      );

      onLog(`Успешно отправлено на GitHub! Коммит: ${result.commitSha.slice(0, 7)}`, 'success');
      loadRemoteCommitsList();
      alert(
        `Успешно отправлено в ветку ${gitHubConfig.branch} на GitHub!\nСсылка: ${result.commitUrl}`
      );
    } catch (err: any) {
      onLog(`Ошибка отправки на GitHub: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setPushing(false);
    }
  };

  const handleCreateNewRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim() || !gitHubConfig.token) return;

    setCreatingRepo(true);
    try {
      onLog(`Создание репозитория "${newRepoName}" на GitHub...`, 'info');
      const created = await createRepository(
        gitHubConfig.token,
        newRepoName.trim(),
        isPrivate,
        project ? `Automated backup of ${project.title} via ScriptVault` : 'Created via ScriptVault'
      );

      onLog(`Репозиторий ${created.full_name} успешно создан!`, 'success');
      setRepos([created, ...repos]);
      onUpdateConfig({
        ...gitHubConfig,
        owner: created.full_name.split('/')[0],
        repo: created.name,
        branch: created.default_branch || 'main'
      });
      setShowCreateRepoModal(false);
      setNewRepoName('');
    } catch (err: any) {
      onLog(`Ошибка создания репозитория: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setCreatingRepo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Github className="w-6 h-6 text-slate-100" />
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
        </div>

        {gitHubConfig.connected && gitUser ? (
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex-wrap">
            <img
              src={gitUser.avatar_url}
              alt={gitUser.login}
              className="w-7 h-7 rounded-full border border-slate-700"
            />
            <div className="text-xs">
              <span className="text-slate-400">{t.connectedAs} </span>
              <a
                href={gitUser.html_url}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-white hover:text-indigo-400 inline-flex items-center gap-1 font-mono"
              >
                @{gitUser.login}
                <ExternalLink className="w-3 h-3" />
              </a>
              <div className="text-[10px] text-slate-500 font-mono">
                {maskToken(gitHubConfig.token)}
              </div>
            </div>

            {/* Switch Key Button */}
            <button
              type="button"
              onClick={() => setShowTokenModal(true)}
              className="px-2.5 py-1 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition flex items-center gap-1.5 cursor-pointer ml-1"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Сменить ключ</span>
            </button>

            {/* Disconnect Button */}
            <button
              onClick={handleDisconnect}
              className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer ml-1"
            >
              {t.disconnectBtn}
            </button>
          </div>
        ) : (
          savedTokens.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTokenModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Выбрать сохраненный ключ ({savedTokens.length})</span>
            </button>
          )
        )}
      </div>

      {/* GitHub Authentication Card */}
      {!gitHubConfig.connected ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Key className="w-5 h-5 text-indigo-400" />
              <span>Подключение через Personal Access Token (PAT)</span>
            </div>
            {savedTokens.length > 0 && (
              <span className="text-xs text-slate-400">Сохранено ключей: {savedTokens.length}</span>
            )}
          </div>

          {/* Quick Select from Saved Tokens if available */}
          {savedTokens.length > 0 && (
            <div className="space-y-2.5 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Быстрый вход по сохраненным ключам:</span>
                <span className="text-[11px] text-slate-500">Нажмите «Выбрать»</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {savedTokens.map((tok) => (
                  <div
                    key={tok.id}
                    className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-2 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {tok.avatarUrl ? (
                        <img
                          src={tok.avatarUrl}
                          alt={tok.username || tok.name}
                          className="w-7 h-7 rounded-full border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">
                          <Github className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{tok.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {maskToken(tok.token)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectSavedToken(tok)}
                        disabled={switchingToken || validating}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition cursor-pointer disabled:opacity-50"
                      >
                        {switchingToken ? '...' : 'Выбрать'}
                      </button>
                      <button
                        type="button"
                        onClick={() => promptDeleteToken(tok)}
                        className="p-1 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                        title="Удалить сохраненный токен"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Token Input Form */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-300">
              {savedTokens.length > 0 ? 'Или введите новый Personal Access Token:' : t.tokenLabel}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={t.tokenPlaceholder}
                className="sm:col-span-2 px-4 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="text"
                value={newTokenLabel}
                onChange={(e) => setNewTokenLabel(e.target.value)}
                placeholder="Метка (например: Личный)"
                className="px-3 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={() => handleValidate(tokenInput, newTokenLabel)}
              disabled={validating || !tokenInput.trim()}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {validating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Проверка токена...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.connectBtn}</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-slate-300 font-semibold">Как получить токен за 1 минуту:</div>
              <p className="leading-relaxed">{t.tokenHelp}</p>
            </div>
          </div>
        </div>
      ) : (
        /* Repository & Branch Configuration */
        <div className="space-y-6">
          {/* Active Key Status Bar with Switch Button */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>Активный ключ GitHub:</span>
                  <span className="text-indigo-400 font-mono">@{gitUser?.login}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                    Подключен
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>Токен: {maskToken(gitHubConfig.token)}</span>
                  {savedTokens.length > 1 && (
                    <span className="text-slate-500">• Сохранено ключей: {savedTokens.length}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTokenModal(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Выбрать другой ключ / Добавить</span>
              </button>
            </div>
          </div>
          {/* Repository Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-indigo-400" />
                <span>{t.repoSection}</span>
              </h3>

              <button
                type="button"
                onClick={() => setShowCreateRepoModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.createRepoBtn}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Repo selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.selectRepo}
                </label>
                <select
                  value={`${gitHubConfig.owner}/${gitHubConfig.repo}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    const [owner, repo] = val.split('/');
                    const selected = repos.find((r) => r.full_name === val);
                    onUpdateConfig({
                      ...gitHubConfig,
                      owner,
                      repo,
                      branch: selected?.default_branch || 'main'
                    });
                  }}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {repos.map((r) => (
                    <option key={r.id} value={r.full_name}>
                      {r.full_name} {r.private ? '🔒' : '🌐'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target folder path */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.pathLabel}
                </label>
                <input
                  type="text"
                  value={gitHubConfig.path || ''}
                  onChange={(e) => onUpdateConfig({ ...gitHubConfig, path: e.target.value })}
                  placeholder="например: Таблица_Финансы/ (или пусто для корня)"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                {/* Folder Suggestions */}
                {project && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px]">
                    <span className="text-slate-500">Папка для скрипта:</span>
                    {project.parentTitle && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            ...gitHubConfig,
                            path: project.parentTitle
                              ? project.parentTitle.replace(/[\\/:*?"<>|]/g, '_')
                              : ''
                          })
                        }
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition cursor-pointer"
                      >
                        📁 {project.parentTitle}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateConfig({
                          ...gitHubConfig,
                          path: `${project.title.replace(/[\\/:*?"<>|]/g, '_')}`
                        })
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition cursor-pointer"
                    >
                      📁 {project.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ ...gitHubConfig, path: '' })}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition cursor-pointer"
                    >
                      Корень (/)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

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
                defaultBranch={
                  repos.find((r) => r.name === gitHubConfig.repo)?.default_branch || 'main'
                }
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            {/* Auto Push Toggle */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-200">{t.autoPushToggle}</div>
                <div className="text-xs text-slate-400">
                  При каждом локальном коммите или резервной копии код будет отправляться в ветку{' '}
                  <b>{gitHubConfig.branch}</b>.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={gitHubConfig.autoPush}
                  onChange={(e) => onUpdateConfig({ ...gitHubConfig, autoPush: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>

            {/* Manual Push Button */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handlePushCurrentCode}
                disabled={pushing || !gitHubConfig.repo}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className={`w-4 h-4 ${pushing ? 'animate-bounce' : ''}`} />
                <span>
                  {pushing ? t.pushing : `${t.pushNowBtn} (ветка: ${gitHubConfig.branch})`}
                </span>
              </button>
            </div>
          </div>

          {/* Remote Commits Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {t.recentCommitsTitle}{' '}
                  <code className="text-purple-300">({gitHubConfig.branch})</code>
                </span>
              </h4>
              <button
                type="button"
                onClick={loadRemoteCommitsList}
                disabled={loadingCommits}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingCommits ? 'animate-spin' : ''}`} />
                <span>{t.refreshCommits}</span>
              </button>
            </div>

            {remoteCommits.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950/40 text-xs text-slate-500 text-center font-mono">
                {t.noRemoteCommits}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl bg-slate-950/60 overflow-hidden font-mono text-xs">
                {remoteCommits.map((c) => (
                  <div
                    key={c.sha}
                    className="p-3 hover:bg-slate-900/60 transition flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-purple-300 shrink-0 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                        {c.sha}
                      </span>
                      <span className="text-slate-200 truncate">{c.message}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-slate-500 text-[11px]">
                      <span>{c.author}</span>
                      {c.html_url && (
                        <a
                          href={c.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-white"
                          title="Открыть на GitHub"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
      {showCreateRepoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-200 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-indigo-400" />
              <span>{t.createModalTitle}</span>
            </h3>

            <form onSubmit={handleCreateNewRepo} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Название репозитория
                </label>
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder={t.repoNamePlaceholder}
                  autoFocus
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrivateCheck"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="isPrivateCheck" className="text-xs text-slate-300 cursor-pointer">
                  {t.privateOption}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateRepoModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={creatingRepo || !newRepoName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {creatingRepo ? 'Создание...' : t.createBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage & Switch GitHub Tokens */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl text-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Управление ключами GitHub</h3>
                  <p className="text-xs text-slate-400">
                    Выберите сохраненный токен или добавьте новый
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Saved tokens list */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Сохраненные ключи ({savedTokens.length}):</span>
              </div>

              {savedTokens.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                  Нет сохраненных ключей. Добавьте первый токен ниже.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {savedTokens.map((tok) => {
                    const isActive = gitHubConfig.token === tok.token && gitHubConfig.connected;
                    return (
                      <div
                        key={tok.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                          isActive
                            ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {tok.avatarUrl ? (
                            <img
                              src={tok.avatarUrl}
                              alt={tok.username || tok.name}
                              className="w-8 h-8 rounded-full border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">
                              <Github className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white truncate">
                                {tok.name}
                              </span>
                              {isActive && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 shrink-0">
                                  Активен
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                              {maskToken(tok.token)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleSelectSavedToken(tok)}
                              disabled={switchingToken || validating}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition cursor-pointer disabled:opacity-50"
                            >
                              {switchingToken ? '...' : 'Выбрать этот ключ'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => promptDeleteToken(tok)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Удалить сохраненный ключ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add New Key Section */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Добавить и подключить новый токен</span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    value={newTokenInput}
                    onChange={(e) => setNewTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx или github_pat_..."
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Метка / имя ключа (опционально)
                  </label>
                  <input
                    type="text"
                    value={newTokenLabel}
                    onChange={(e) => setNewTokenLabel(e.target.value)}
                    placeholder="например: Личный аккаунт, Рабочий или Тестовый"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleValidate(newTokenInput, newTokenLabel)}
                  disabled={validating || !newTokenInput.trim()}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
                >
                  {validating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Проверка и сохранение...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Подключить и сохранить новый ключ</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Branch Deletion */}
      <ConfirmationModal
        isOpen={!!branchToDelete}
        title={t.deleteBranchConfirmTitle}
        message={branchToDelete ? t.deleteBranchConfirmDesc(branchToDelete) : ''}
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

      {/* Confirmation Modal for Token Deletion */}
      <ConfirmationModal
        isOpen={!!tokenToDelete}
        title="Удалить сохраненный ключ GitHub?"
        message={
          tokenToDelete
            ? `Вы уверены, что хотите удалить сохраненный ключ "${tokenToDelete.name}" (${maskToken(tokenToDelete.token)})?`
            : ''
        }
        isDestructive={true}
        confirmLabel="Да, удалить ключ"
        cancelLabel="Отмена"
        details={
          tokenToDelete
            ? [
                `Имя токена: ${tokenToDelete.name}`,
                tokenToDelete.username ? `Пользователь: @${tokenToDelete.username}` : '',
                gitHubConfig.token === tokenToDelete.token
                  ? 'Внимание: этот токен сейчас активен, после удаления GitHub будет отключен'
                  : 'Токен будет удален из списка сохраненных'
              ].filter(Boolean)
            : []
        }
        onConfirm={() => {
          if (tokenToDelete) {
            confirmDeleteToken(tokenToDelete.id);
            setTokenToDelete(null);
          }
        }}
        onCancel={() => setTokenToDelete(null)}
      />
    </div>
  );
};
