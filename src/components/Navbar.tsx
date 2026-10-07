import React, { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { RefreshCw, Github, Database, LogOut, CheckCircle2, X, Search } from 'lucide-react';
import { useT } from '../i18n';

export const Navbar: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const hasGoogleToken = useAppStore((s) => !!s.accessToken);
  const onGoogleSignIn = useAppStore((s) => s.signIn);
  const onLogout = useAppStore((s) => s.signOut);
  const isLoggingIn = useAppStore((s) => s.isLoggingIn);
  const gitHubConnected = useAppStore((s) => s.gitHubConfig.connected);
  const isSyncing = useAppStore((s) => s.isSyncing);
  const countdown = useAppStore((s) => s.countdown);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const activeScriptsCount = useAppStore((s) => s.activeScriptsCount);
  const onManualSync = useAppStore((s) => s.manualSync);
  const onCancelSync = useAppStore((s) => s.cancelSync);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const isSearchOpen = useAppStore((s) => s.isSearchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const t = useT('nav');
  const searchT = useT('search');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(!isSearchOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSearchOpen, setSearchOpen]);

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Database className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">{t.appName}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Real-time
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">{t.tagline}</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'workspace'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.tabs.workspace}
            </button>
            <button
              onClick={() => setActiveTab('sheets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'sheets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.tabs.sheets}
            </button>
            <button
              onClick={() => setActiveTab('git')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'git'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.tabs.git}
            </button>
            <button
              onClick={() => setActiveTab('github')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'github'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Github className="w-3.5 h-3.5" />
              {t.tabs.github}
              {gitHubConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
            <button
              onClick={() => setActiveTab('drive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'drive'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.tabs.drive}
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {t.tabs.logs}
            </button>
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center gap-2.5">
            {/* Global search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title={`${searchT.open} (Ctrl+K)`}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{searchT.open}</span>
              <span className="hidden lg:inline-flex items-center gap-1 ml-1 px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono">
                ⌘K
              </span>
            </button>
            {/* Real-time sync ticker & manual trigger */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSyncing ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isSyncing ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span className="text-slate-300 font-mono text-[11px]">
                {isSyncing ? t.syncing : `${t.liveWatcher} ${countdown}s`}
              </span>
              {lastSyncedAt && (
                <span
                  title={lastSyncedAt.toLocaleString()}
                  className="text-slate-500 font-mono text-[10px]"
                >
                  {lang === 'ru' ? 'обн.' : 'upd.'} {lastSyncedAt.toLocaleTimeString()}
                </span>
              )}
              {activeScriptsCount !== undefined && activeScriptsCount > 0 && (
                <span
                  title="Количество отслеживаемых скриптов"
                  className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30"
                >
                  {activeScriptsCount} скр.
                </span>
              )}
              {isSyncing ? (
                <button
                  onClick={onCancelSync}
                  title={t.cancelSync}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-rose-400" />
                </button>
              ) : (
                <button
                  onClick={onManualSync}
                  title={t.syncNow}
                  className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
              className="px-2 py-1 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition uppercase cursor-pointer"
              title="Switch language / Сменить язык"
            >
              {lang}
            </button>

            {/* Auth Button / User Profile */}
            {user && hasGoogleToken ? (
              <div className="flex items-center gap-2 pl-1">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-6 h-6 rounded-full border border-slate-700"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      {user.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="text-xs text-slate-200 hidden sm:inline max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </span>
                  <span title={t.connectedDrive}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  title="Logout"
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-xl border border-slate-800/80 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onGoogleSignIn}
                disabled={isLoggingIn}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-100 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {/* Official Google Icon */}
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isLoggingIn ? t.signingIn : t.signIn}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1 border-t border-slate-800/80 no-scrollbar">
          {(['workspace', 'sheets', 'git', 'github', 'drive', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 bg-slate-900'
              }`}
            >
              {t.tabs[tab]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
