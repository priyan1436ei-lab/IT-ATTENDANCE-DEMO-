import React, { useState } from 'react';
import { ExternalLink, CheckCircle, Clock, AlertTriangle, Calendar, FileSpreadsheet, UserCheck, RefreshCw, Sparkles } from 'lucide-react';
import { AttendanceSession, SheetRowData, AppUserSession, SheetTabInfo } from '../types/attendance';

interface StudentPortalViewProps {
  currentUser: AppUserSession;
  activeSession: AttendanceSession | null;
  sheetRecords: SheetRowData[];
  onOpenForm: () => void;
  availableTabs?: SheetTabInfo[];
  activeTabName?: string;
  onSelectTab?: (tabName: string) => void;
  onSelfMarkAttendance?: () => Promise<void>;
  isSyncing?: boolean;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  currentUser,
  activeSession,
  sheetRecords,
  onOpenForm,
  availableTabs = [],
  activeTabName = 'Attendance Records',
  onSelectTab,
  onSelfMarkAttendance,
  isSyncing = false
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selfMarkNotice, setSelfMarkNotice] = useState<string | null>(null);

  // Find my attendance in the current sheet records
  const myRecord = sheetRecords.find(
    (r) => r.rollNumber.trim().toUpperCase() === currentUser.identifier.trim().toUpperCase()
  );

  const isMarked = !!myRecord;

  const handleSelfMark = async () => {
    if (!onSelfMarkAttendance) return;
    setIsSubmitting(true);
    setSelfMarkNotice(null);
    try {
      await onSelfMarkAttendance();
      setSelfMarkNotice('✓ Attendance recorded directly into Google Sheet!');
      setTimeout(() => setSelfMarkNotice(null), 4000);
    } catch (err: any) {
      setSelfMarkNotice(`Note: ${err.message || 'Error recording attendance.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('present')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Present
        </span>
      );
    }
    if (s.includes('late')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <Clock className="w-4 h-4 text-amber-600" />
          Late
        </span>
      );
    }
    if (s.includes('excused') || s.includes('duty') || s.includes('od')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
          On Duty (OD)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
        <AlertTriangle className="w-4 h-4 text-rose-600" />
        Absent
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Student Welcome Card */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-medium text-emerald-200 border border-white/20 mb-3">
              <span>Student Portal</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">{currentUser.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-emerald-100 font-mono">
              <span>Roll No: {currentUser.identifier}</span>
              <span>•</span>
              <span>{currentUser.department}</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-center sm:text-right">
            <p className="text-[11px] text-emerald-200">Attendance in Tab ({activeTabName})</p>
            <div className="mt-1.5">
              {isMarked ? (
                <div className="inline-flex items-center gap-1.5 bg-emerald-500 text-white font-bold px-3 py-1 rounded-xl text-xs shadow-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Recorded in Google Sheet!</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-amber-500 text-white font-bold px-3 py-1 rounded-xl text-xs shadow-sm">
                  <Clock className="w-4 h-4" />
                  <span>Not Marked in this Tab</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Date Sheet Tabs Bar for Student */}
      {availableTabs.length > 0 && onSelectTab && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Select Date Tab to View Attendance:</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Live synced with Google Sheet
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {availableTabs.map((t) => {
              const isActive = activeTabName === t.title;
              return (
                <button
                  key={t.sheetId}
                  onClick={() => onSelectTab(t.title)}
                  className={`px-3 py-1.5 text-xs rounded-xl font-medium transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Attendance Action Card */}
      {activeSession ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Class Session</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{activeSession.subject}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{activeSession.title} • {activeSession.date}</p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {!isMarked && onSelfMarkAttendance && (
                <button
                  onClick={handleSelfMark}
                  disabled={isSubmitting || isSyncing}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md transition hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  title="Mark your attendance directly into the Google Sheet"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Recording in Sheet...' : 'Mark My Attendance (Present)'}</span>
                </button>
              )}

              {activeSession.formResponderUri && (
                <a
                  href={activeSession.formResponderUri}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-xs transition cursor-pointer"
                >
                  <span>Submit in Google Form</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Feedback Notice */}
          {selfMarkNotice && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{selfMarkNotice}</span>
            </div>
          )}

          {/* Status Breakdown for Student */}
          <div className="pt-6">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Attendance Verification Details (Tab: {activeTabName}):
            </h4>

            {isMarked ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-semibold">Attendance Status:</span>
                  <div>{getStatusDisplay(myRecord.status)}</div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Recorded Timestamp:</span>
                  <span className="font-mono text-slate-800 font-semibold">{myRecord.timestamp}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Session / Class:</span>
                  <span className="text-slate-800 font-medium">{myRecord.session || activeSession.subject}</span>
                </div>

                {myRecord.notes && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Remarks:</span>
                    <span className="text-slate-800 font-medium">{myRecord.notes}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-900">
                      Attendance not recorded in Google Sheet tab '{activeTabName}' yet
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      You can click <strong>"Mark My Attendance"</strong> above, or submit the Google Form with your Roll Number ({currentUser.identifier}).
                    </p>
                  </div>
                </div>

                {onSelfMarkAttendance && (
                  <button
                    onClick={handleSelfMark}
                    disabled={isSubmitting || isSyncing}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Recording...' : 'Check In Now'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500">
          No active class session configured by the administrator yet.
        </div>
      )}
    </div>
  );
};
