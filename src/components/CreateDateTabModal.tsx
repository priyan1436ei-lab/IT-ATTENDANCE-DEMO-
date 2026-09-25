import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Copy, CheckCircle, FileSpreadsheet, X, Sparkles } from 'lucide-react';
import { SheetTabInfo } from '../types/attendance';

interface CreateDateTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTabs: SheetTabInfo[];
  currentActiveTab: string;
  onCreateTab: (tabName: string, copyFromSheetId?: number) => Promise<void>;
  isCreating: boolean;
}

export const CreateDateTabModal: React.FC<CreateDateTabModalProps> = ({
  isOpen,
  onClose,
  existingTabs,
  currentActiveTab,
  onCreateTab,
  isCreating
}) => {
  // Compute default next date (tomorrow)
  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const getTodayDateStr = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [dateStr, setDateStr] = useState(getTomorrowDateStr());
  const [duplicateFromExisting, setDuplicateFromExisting] = useState(true);
  const [sourceTabTitle, setSourceTabTitle] = useState(currentActiveTab || existingTabs[0]?.title || '');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDateStr(getTomorrowDateStr());
      setSourceTabTitle(currentActiveTab || existingTabs[0]?.title || '');
      setErrorMsg('');
    }
  }, [isOpen, currentActiveTab, existingTabs]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = dateStr.trim();

    if (!cleanName) {
      setErrorMsg('Please select or enter a valid date or tab name.');
      return;
    }

    // Check if already exists
    const exists = existingTabs.some(
      (t) => t.title.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      setErrorMsg(`A tab named "${cleanName}" already exists in this Google Sheet. Please choose another date.`);
      return;
    }

    let sourceSheetId: number | undefined;
    if (duplicateFromExisting) {
      const found = existingTabs.find((t) => t.title === sourceTabTitle);
      if (found) {
        sourceSheetId = found.sheetId;
      } else if (existingTabs.length > 0) {
        sourceSheetId = existingTabs[0].sheetId;
      }
    }

    try {
      await onCreateTab(cleanName, sourceSheetId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create tab in Google Sheet.');
    }
  };

  const todayStr = getTodayDateStr();
  const tomorrowStr = getTomorrowDateStr();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create Next Day Sheet Tab</h3>
              <p className="text-xs text-slate-300">Add a new date tab inside your Google Sheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Quick Date Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Quick Suggestions
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDateStr(tomorrowStr)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  dateStr === tomorrowStr
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Next Day ({tomorrowStr})</span>
              </button>

              <button
                type="button"
                onClick={() => setDateStr(todayStr)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
                  dateStr === todayStr
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Today ({todayStr})
              </button>
            </div>
          </div>

          {/* Date Picker Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Attendance Date / Tab Title:
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              A new sheet tab named <span className="font-mono font-bold text-slate-700">{dateStr || '...'}</span> will be created in your Google Spreadsheet.
            </p>
          </div>

          {/* Duplicate Structure Options */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="dupCheckbox"
                checked={duplicateFromExisting}
                onChange={(e) => setDuplicateFromExisting(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="dupCheckbox" className="text-xs font-medium text-slate-800 cursor-pointer">
                Duplicate structure from existing tab
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Keeps the exact header row styling, column widths, and format from the previous day, with fresh blank rows for the new day's attendance.
                </p>
              </label>
            </div>

            {duplicateFromExisting && existingTabs.length > 0 && (
              <div className="pl-6 pt-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Copy template from tab:
                </label>
                <select
                  value={sourceTabTitle}
                  onChange={(e) => setSourceTabTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {existingTabs.map((t) => (
                    <option key={t.sheetId} value={t.title}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* What happens next box */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2 text-[11px] text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Automatic date sync:</strong> Once created, this date tab becomes the active sheet tab. Form responses and attendance marked will automatically save into this date's tab!
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !dateStr}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Creating Tab in Google Sheet...' : 'Create & Switch to Tab'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
