import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import {
  Github,
  Key,
  FolderGit2,
  UploadCloud,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  HelpCircle,
  GitPullRequest
} from 'lucide-react';
import { clearToken, isRemembered, maskToken, saveToken } from '../services/tokenStore';
import {
  validateGitHubToken,
  listRepositories,
  createRepository,
  pushFilesToGitHub,
  createBranch,
  createPullRequest,
  GitHubUser,
  GitHubRepo
} from '../services/githubService';
import { BranchManager } from './BranchManager';
import { RemoteCommitsFeed } from './RemoteCommitsFeed';
import { useT } from '../i18n';

export const GitHubPanel: React.FC = () => {
  const project = useAppStore((s) => s.currentProject);
  const gitHubConfig = useAppStore((s) => s.gitHubConfig);
  const onUpdateConfig = useAppStore((s) => s.updateGitHubConfig);
  const lang = useAppStore((s) => s.lang);
  const addLog = useAppStore((s) => s.addLog);
  const onLog = (msg: string, type?: 'info' | 'success' | 'warning' | 'error') =>
    addLog(msg, type ?? 'info', 'github');
  const [tokenInput, setTokenInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [gitUser, setGitUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [, setLoadingRepos] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [commitsRefreshKey, setCommitsRefreshKey] = useState(0);
  const repoDefaultBranch = repos.find((r) => r.name === gitHubConfig.repo)?.default_branch;

  // Token persistence: session-only by default, localStorage when "remember" is checked
  const [rememberToken, setRememberToken] = useState(() => isRemembered());

  // Branch management state

  // Create repo modal
  const [showCreateRepoModal, setShowCreateRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [creatingRepo, setCreatingRepo] = useState(false);

  // Pull Request modal
  const [showPRModal, setShowPRModal] = useState(false);
  const [prBranchName, setPrBranchName] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBaseBranch, setPrBaseBranch] = useState('main');
  const [creatingPR, setCreatingPR] = useState(false);

  const t = useT('github');

  // Validate token on mount if present
  useEffect(() => {
    if (gitHubConfig.token && !gitUser) {
      handleValidate(gitHubConfig.token, false);
    }
  }, [gitHubConfig.token]);

  // Initialize PR defaults when opening modal or project changes
  useEffect(() => {
    if (project && showPRModal && !prBranchName) {
      const safeTitle = project.title.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 30);
      const ts = new Date().toISOString().slice(0, 10);
      setPrBranchName(`scriptvault/${safeTitle}-${ts}`);
      setPrTitle(`Update ${project.title} (${project.parentTitle || 'Apps Script'})`);
    }
    if (repoDefaultBranch && prBaseBranch === 'main') {
      setPrBaseBranch(repoDefaultBranch);
    }
  }, [project, showPRModal, prBranchName, repoDefaultBranch, prBaseBranch]);

  async function handleValidate(token: string, logSuccess = true) {
    if (!token.trim()) return;
    setValidating(true);
    try {
      const cleanToken = token.trim();
      const user = await validateGitHubToken(cleanToken);
      setGitUser(user);

      // Persist token according to the remember policy (session by default)
      saveToken(cleanToken, { remember: rememberToken, username: user.login });

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
      setTokenInput('');
    } catch (err: any) {
      onLog(`Ошибка подключения GitHub: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setValidating(false);
      setLoadingRepos(false);
    }
  }

  const handleDisconnect = () => {
    clearToken();
    setTokenInput('');
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
    onLog('GitHub отключен', 'info');
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
      setCommitsRefreshKey((k) => k + 1);
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

  const handleCreatePullRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!gitHubConfig.token || !gitHubConfig.owner || !gitHubConfig.repo) return;
    if (!prBranchName.trim() || !prTitle.trim()) return;

    setCreatingPR(true);
    try {
      const base = prBaseBranch || repoDefaultBranch || 'main';
      const newBranch = prBranchName.trim();
      onLog(`Создание ветки "${newBranch}" от "${base}"...`, 'info');
      try {
        await createBranch(gitHubConfig.token, gitHubConfig.owner, gitHubConfig.repo, newBranch, base);
      } catch (branchErr: any) {
        // If branch already exists, continue — we will push to it
        if (!String(branchErr.message).toLowerCase().includes('already exists')) {
          // try to continue anyway if error is about existence
          onLog(`Ветка ${newBranch} уже существует или ошибка создания: ${branchErr.message}`, 'warning');
        }
      }

      onLog(`Отправка файлов проекта в ветку "${newBranch}"...`, 'info');
      await pushFilesToGitHub(
        gitHubConfig.token,
        gitHubConfig.owner,
        gitHubConfig.repo,
        newBranch,
        project.files,
        `${prTitle} [ScriptVault]`,
        gitHubConfig.path || ''
      );

      onLog(`Создание Pull Request "${prTitle}" (${newBranch} → ${base})...`, 'info');
      const pr = await createPullRequest(
        gitHubConfig.token,
        gitHubConfig.owner,
        gitHubConfig.repo,
        newBranch,
        base,
        prTitle,
        `Автоматически создан из ScriptVault для проекта "${project.title}"${project.parentTitle ? ` (таблица: ${project.parentTitle})` : ''}.\n\nСодержит ${project.files.length} файлов.`
      );

      onLog(`Pull Request #${pr.number} создан: ${pr.html_url}`, 'success');
      setCommitsRefreshKey((k) => k + 1);
      setShowPRModal(false);
      setPrBranchName('');
      setPrTitle('');
      alert(`Pull Request успешно создан!\n#${pr.number}: ${pr.title}\n${pr.html_url}`);
    } catch (err: any) {
      onLog(`Ошибка создания PR: ${err.message}`, 'error');
      alert(`Ошибка: ${err.message}`);
    } finally {
      setCreatingPR(false);
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

            {/* Disconnect Button */}
            <button
              onClick={handleDisconnect}
              className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer ml-1"
            >
              {t.disconnectBtn}
            </button>
          </div>
        ) : null}
      </div>

      {/* GitHub Authentication Card */}
      {!gitHubConfig.connected ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Key className="w-5 h-5 text-indigo-400" />
              <span>Подключение через Personal Access Token (PAT)</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-300">{t.tokenLabel}</div>
            <input
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={t.tokenPlaceholder}
              className="w-full px-4 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberToken}
                onChange={(e) => setRememberToken(e.target.checked)}
                className="rounded border-slate-600 bg-slate-950 cursor-pointer"
              />
              <span>
                Запомнить токен на этом устройстве
                <span className="text-slate-500">
                  {' '}
                  (хранится в localStorage — не используйте на общих компьютерах)
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={() => handleValidate(tokenInput)}
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
                  <span className="text-slate-500">
                    •{' '}
                    {isRemembered()
                      ? 'запомнен на этом устройстве'
                      : 'хранится до закрытия вкладки'}
                  </span>
                </div>
              </div>
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

          <BranchManager defaultBranch={repoDefaultBranch} />

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

            {/* Manual Push Buttons */}
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const safeTitle = project
                    ? project.title.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 30)
                    : 'script';
                  const ts = new Date().toISOString().slice(0, 10);
                  setPrBranchName(`scriptvault/${safeTitle}-${ts}`);
                  setPrTitle(project ? `Update ${project.title}` : 'Update from ScriptVault');
                  setShowPRModal(true);
                }}
                disabled={!gitHubConfig.repo || !project}
                className="px-4 py-2.5 text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <GitPullRequest className="w-4 h-4" />
                <span>Создать Pull Request</span>
              </button>

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

          <RemoteCommitsFeed refreshKey={commitsRefreshKey} />
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

      {/* Modal: Create Pull Request */}
      {showPRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-200 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <GitPullRequest className="w-5 h-5 text-indigo-400" />
              <span>Создание Pull Request</span>
            </h3>

            <form onSubmit={handleCreatePullRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Базовая ветка (base)</label>
                <input
                  type="text"
                  value={prBaseBranch}
                  onChange={(e) => setPrBaseBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Новая ветка (head)</label>
                <input
                  type="text"
                  value={prBranchName}
                  onChange={(e) => setPrBranchName(e.target.value)}
                  placeholder="scriptvault/my-feature-2026-01-01"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Заголовок PR</label>
                <input
                  type="text"
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  placeholder="Update MyProject"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed">
                Создаётся новая ветка от <span className="font-mono text-slate-300">{prBaseBranch}</span>, в неё
                пушатся текущие файлы проекта, затем открывается PR{' '}
                <span className="font-mono text-slate-300">
                  {prBranchName || '...'} → {prBaseBranch}
                </span>
                .
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPRModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creatingPR || !prBranchName.trim() || !prTitle.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creatingPR ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Создание...
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="w-3.5 h-3.5" /> Создать PR
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
