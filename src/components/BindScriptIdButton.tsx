/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { Link2, X, AlertTriangle, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { isCloudBoundProject } from '../services/projectOrigin';
import { useT } from '../i18n';

export interface BindScriptIdButtonProps {
  /** Rendered next to the project id chip in the workspace header. */
  className?: string;
}

/**
 * Shown for projects that only exist locally (imported from files). Lets the
 * user bind a real Apps Script id so push/run/deploy become available.
 */
export const BindScriptIdButton: React.FC<BindScriptIdButtonProps> = ({ className }) => {
  const project = useAppStore((s) => s.currentProject);
  const bindScriptId = useAppStore((s) => s.bindScriptId);
  const showToast = useAppStore((s) => s.showToast);
  const t = useT('transfer');

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!project || isCloudBoundProject(project)) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = bindScriptId(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setValue('');
    setError(null);
    showToast(t.bindSuccess, 'success');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t.bindChip}
        className={
          className ||
          'text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition hover:bg-amber-500/20 cursor-pointer'
        }
      >
        <Link2 className="w-3 h-3" />
        <span>{t.bindChip}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <form
            onSubmit={submit}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl text-slate-200 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t.bindTitle}</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{t.bindDesc}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span className="leading-relaxed">{t.bindWarning}</span>
            </div>

            <div>
              <input
                autoFocus
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                placeholder={t.bindPlaceholder}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              {error && <p className="mt-1.5 text-[11px] text-rose-400">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                {t.bindCancel}
              </button>
              <button
                type="submit"
                disabled={!value.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                {t.bindSubmit}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default BindScriptIdButton;
