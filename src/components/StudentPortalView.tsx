import React from 'react';
import { ExternalLink, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { AttendanceSession, SheetRowData, AppUserSession } from '../types/attendance';

interface StudentPortalViewProps {
  currentUser: AppUserSession;
  activeSession: AttendanceSession | null;
  sheetRecords: SheetRowData[];
  onOpenForm: () => void;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  currentUser,
  activeSession,
  sheetRecords,
  onOpenForm
}) => {
  // Find my attendance in the current sheet records
  const myRecord = sheetRecords.find(
    (r) => r.rollNumber.trim().toUpperCase() === currentUser.identifier.trim().toUpperCase()
  );

  const isMarked = !!myRecord;

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
            <p className="text-[11px] text-emerald-200">Today's Attendance Status</p>
            <div className="mt-1.5">
              {isMarked ? (
                <div className="inline-flex items-center gap-1.5 bg-emerald-500 text-white font-bold px-3 py-1 rounded-xl text-xs shadow-sm">
                  <CheckCircle className="w-4 h-4" />
                  <span>Recorded in Google Sheet!</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-amber-500 text-white font-bold px-3 py-1 rounded-xl text-xs shadow-sm">
                  <Clock className="w-4 h-4" />
                  <span>Not Marked Yet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Attendance Action Card */}
      {activeSession ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Class Session</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{activeSession.subject}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{activeSession.title} • {activeSession.date}</p>
            </div>

            {activeSession.formResponderUri && (
              <a
                href={activeSession.formResponderUri}
                target="_blank"
                rel="noreferrer"
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md transition hover:shadow-lg cursor-pointer"
              >
                <span>Mark Attendance in Google Form</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Status Breakdown for Student */}
          <div className="pt-6">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Attendance Verification Details:
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
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-amber-900">Attendance not recorded yet today</h5>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Click the "Mark Attendance in Google Form" button above, submit your Roll Number ({currentUser.identifier}), and your status will automatically appear here once synchronized.
                    </p>
                  </div>
                </div>

                {activeSession.formResponderUri && (
                  <a
                    href={activeSession.formResponderUri}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl transition"
                  >
                    Open Google Form
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          <p className="text-sm font-bold text-slate-700">No active class session currently.</p>
          <p className="text-xs text-slate-400 mt-1">Please wait for your instructor or admin to link a class session.</p>
        </div>
      )}
    </div>
  );
};
