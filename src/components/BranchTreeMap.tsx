import React, { useState } from 'react';
import {
  GitBranch,
  GitFork,
  ArrowRight,
  Check,
  Lock,
  Trash2,
  ExternalLink,
  Plus,
  RefreshCw,
  GitCommit as GitCommitIcon,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Equal
} from 'lucide-react';
import { GitHubBranch, BranchComparison } from '../services/githubService';

interface BranchTreeMapProps {
  branches: GitHubBranch[];
  activeBranch: string;
  defaultBranch?: string;
  repoOwner: string;
  repoName: string;
  comparisons?: Record<string, BranchComparison>;
  onSwitchBranch: (branchName: string) => void;
  onCreateFromBranch: (baseBranch: string) => void;
  onDeleteBranch: (branchName: string) => void;
  lang: 'ru' | 'en';
}

const BRANCH_COLORS = [
  { stroke: '#818cf8', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-300' },
  { stroke: '#34d399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  { stroke: '#fbbf24', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
  { stroke: '#f43f5e', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300' },
  { stroke: '#38bdf8', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300' },
  { stroke: '#c084fc', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300' },
];

export const BranchTreeMap: React.FC<BranchTreeMapProps> = ({
  branches,
  activeBranch,
  defaultBranch = 'main',
  repoOwner,
  repoName,
  comparisons = {},
  onSwitchBranch,
  onCreateFromBranch,
  onDeleteBranch,
  lang,
}) => {
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranch);

  const t = {
    ru: {
      treeTitle: 'Визуальная схема веток (Branch Tree & Graph)',
      treeSubtitle: 'Графическое представление связей между основной (main), текущей (HEAD) и другими ветками разработки',
      mainTrunk: 'Основная ветка (Trunk)',
      activeHead: 'Активная ветка (HEAD)',
      devBranch: 'Ветка разработки',
      switchBtn: 'Переключить на эту ветку',
      forkBtn: 'Ответвить новую ветку',
      deleteBtn: 'Удалить ветку',
      currentActive: 'Ветка выбрана (HEAD)',
      protected: 'Защищенная ветка',
      inSync: 'Синхронизирована с main',
      ahead: 'впереди main на',
      behind: 'отстает от main на',
      commits: 'комм.',
      openInGitHub: 'Открыть на GitHub',
      noBranches: 'В репозитории пока нет веток для отображения.',
    },
    en: {
      treeTitle: 'Visual Branch Tree & Graph',
      treeSubtitle: 'Graphical diagram of relationships between main trunk, current active branch, and development branches',
      mainTrunk: 'Default Trunk',
      activeHead: 'Active Branch (HEAD)',
      devBranch: 'Development Branch',
      switchBtn: 'Switch to this branch',
      forkBtn: 'Branch from here',
      deleteBtn: 'Delete branch',
      currentActive: 'Currently checked out (HEAD)',
      protected: 'Protected branch',
      inSync: 'In sync with main',
      ahead: 'ahead of main by',
      behind: 'behind main by',
      commits: 'comm.',
      openInGitHub: 'View on GitHub',
      noBranches: 'No branches available to display in tree.',
    },
  }[lang];

  if (!branches || branches.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-950/40 rounded-xl">
        {t.noBranches}
      </div>
    );
  }

  // Ensure default branch is first (e.g. main/master)
  const defaultBr = branches.find((b) => b.name === defaultBranch) || branches[0];
  const otherBranches = branches.filter((b) => b.name !== defaultBr?.name);
  const orderedBranches = defaultBr ? [defaultBr, ...otherBranches] : branches;

  return (
    <div className="space-y-4">
      {/* Legend & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
            <span className="text-slate-300 font-medium">{t.mainTrunk}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500 ring-2 ring-purple-500/30 animate-pulse" />
            <span className="text-purple-300 font-medium">{t.activeHead}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-500" />
            <span className="text-slate-400">{t.devBranch}</span>
          </div>
        </div>

        <span className="text-[11px] text-slate-500 font-mono">
          Всего веток: {branches.length}
        </span>
      </div>

      {/* Interactive Visual Graph Canvas */}
      <div className="relative rounded-2xl bg-slate-950/90 border border-slate-800 p-5 overflow-x-auto shadow-inner">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative min-w-[620px] space-y-6 py-2">
          {orderedBranches.map((branch, index) => {
            const isMain = branch.name === defaultBranch;
            const isActive = branch.name === activeBranch;
            const isSelected = selectedBranch === branch.name;
            const color = isMain
              ? { stroke: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-300' }
              : isActive
              ? { stroke: '#a855f7', bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-300' }
              : BRANCH_COLORS[(index - 1) % BRANCH_COLORS.length];

            const comparison = comparisons[branch.name];

            return (
              <div
                key={branch.name}
                onClick={() => setSelectedBranch(branch.name)}
                className={`group relative flex items-center gap-4 p-3.5 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? `${color.bg} ${color.border} ring-1 ring-inset ${color.border}`
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                {/* Visual Branch Line Indicator */}
                <div className="relative flex items-center justify-center w-12 shrink-0">
                  {/* SVG Railway path connecting branches to trunk */}
                  {!isMain && (
                    <svg
                      className="absolute -top-10 left-3 w-8 h-10 overflow-visible pointer-events-none"
                      fill="none"
                    >
                      <path
                        d="M 0 0 C 0 20, 16 20, 16 40"
                        stroke={color.stroke}
                        strokeWidth="2.5"
                        strokeDasharray={isActive ? 'none' : '3 3'}
                        strokeLinecap="round"
                      />
                    </svg>
                  )}

                  {/* Branch Node Dot */}
                  <div
                    className={`relative w-6 h-6 rounded-full flex items-center justify-center border-2 transition ${
                      isActive
                        ? 'bg-purple-600 border-purple-300 shadow-lg shadow-purple-500/50 ring-4 ring-purple-500/20'
                        : isMain
                        ? 'bg-emerald-600 border-emerald-300 shadow-md shadow-emerald-500/30'
                        : 'bg-slate-800 border-slate-600 group-hover:border-slate-400'
                    }`}
                  >
                    <GitBranch className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                {/* Branch Info Details */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                        <span className={color.text}>{branch.name}</span>
                      </span>

                      {isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                          HEAD
                        </span>
                      )}

                      {isMain && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Main Trunk
                        </span>
                      )}

                      {branch.protected && (
                        <span
                          title={t.protected}
                          className="text-[10px] text-amber-400 flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span>Locked</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      {branch.commit?.sha && (
                        <span>
                          commit: <span className="text-slate-300 font-bold">{branch.commit.sha.slice(0, 7)}</span>
                        </span>
                      )}

                      {/* Compare with main statistics */}
                      {!isMain && comparison && (
                        <span className="flex items-center gap-2 text-[11px]">
                          {comparison.status === 'identical' || (comparison.aheadBy === 0 && comparison.behindBy === 0) ? (
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <Equal className="w-3 h-3" />
                              <span>{t.inSync}</span>
                            </span>
                          ) : (
                            <>
                              {comparison.aheadBy > 0 && (
                                <span className="text-emerald-400 flex items-center gap-0.5">
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>+{comparison.aheadBy} {t.commits}</span>
                                </span>
                              )}
                              {comparison.behindBy > 0 && (
                                <span className="text-amber-400 flex items-center gap-0.5">
                                  <ArrowDownLeft className="w-3 h-3" />
                                  <span>-{comparison.behindBy} {t.commits}</span>
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions for this Branch */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {!isActive ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwitchBranch(branch.name);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>{t.switchBtn}</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{t.currentActive}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFromBranch(branch.name);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title={t.forkBtn}
                    >
                      <GitFork className="w-4 h-4" />
                    </button>

                    <a
                      href={`https://github.com/${repoOwner}/${repoName}/tree/${branch.name}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                      title={t.openInGitHub}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {!isActive && !isMain && !branch.protected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBranch(branch.name);
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition cursor-pointer"
                        title={t.deleteBtn}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
