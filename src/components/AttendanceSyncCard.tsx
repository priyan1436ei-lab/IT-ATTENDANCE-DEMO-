import React, { useState } from 'react';
import { RefreshCw, Play, Square, ExternalLink, QrCode, PlusCircle, Copy, Check, Info } from 'lucide-react';
import { AttendanceSession, AttendanceRecord, SheetRowData } from '../types/attendance';

interface AttendanceSyncCardProps {
  session: AttendanceSession;
  records: AttendanceRecord[];
  sheetRecords: SheetRowData[];
  isSyncing: boolean;
  autoSyncActive: boolean;
  onToggleAutoSync: () => void;
  onManualSync: () => void;
  onOpenQuickMark: () => void;
  lastSyncDetails?: {
    time: string;
    formResponseCount: number;
    newRowsAdded: number;
    alreadyExisting: number;
  } | null;
}

export const AttendanceSyncCard: React.FC<AttendanceSyncCardProps> = ({
  session,
  records,
  sheetRecords,
  isSyncing,
  autoSyncActive,
  onToggleAutoSync,
  onManualSync,
  onOpenQuickMark,
  lastSyncDetails
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const presentCount = sheetRecords.filter((r) => r.status.toLowerCase().includes('present')).length;
  const lateCount = sheetRecords.filter((r) => r.status.toLowerCase().includes('late')).length;
  const excusedCount = sheetRecords.filter((r) => r.status.toLowerCase().includes('excused') || r.status.toLowerCase().includes('duty')).length;
  const absentCount = sheetRecords.filter((r) => r.status.toLowerCase().includes('absent')).length;

  const totalMarked = sheetRecords.length;

  const copyFormLink = () => {
    if (session.formResponderUri) {
      navigator.clipboard.writeText(session.formResponderUri);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const qrImageUrl = session.formResponderUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(session.formResponderUri)}`
    : '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Session Header Banner */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {session.department}
            </span>
            <span className="text-slate-400 text-xs font-mono">{session.date}</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{session.subject}</h2>
          <p className="text-xs text-slate-300">{session.title}</p>
        </div>

        {/* Action Buttons: Direct Links */}
        <div className="flex flex-wrap items-center gap-2">
          {session.formResponderUri && (
            <a
              href={session.formResponderUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition"
            >
              <span>Student Form Link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {session.spreadsheetUrl && (
            <a
              href={session.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
            >
              <span>Open Google Sheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            onClick={copyFormLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition cursor-pointer"
            title="Copy Form URL for students"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied Link!' : 'Share Form'}</span>
          </button>

          <button
            onClick={() => setShowQr(!showQr)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition cursor-pointer"
            title="Project QR code in classroom for students to scan"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Classroom QR</span>
          </button>
        </div>
      </div>

      {/* QR Code Projector Modal/Panel */}
      {showQr && (
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col items-center justify-center text-center animate-in fade-in">
          <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-200 mb-3">
            <img src={qrImageUrl} alt="Class Attendance QR Code" className="w-48 h-48 sm:w-56 sm:h-56" />
          </div>
          <p className="text-sm font-bold text-slate-800">Scan to Mark Attendance</p>
          <p className="text-xs text-slate-500 max-w-sm mt-0.5">
            Students scan this QR code with their mobile cameras to immediately submit attendance in Google Form.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={copyFormLink}
              className="text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 font-medium px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              {copiedLink ? 'Link Copied!' : 'Copy Form URL'}
            </button>
            <button
              onClick={() => setShowQr(false)}
              className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 cursor-pointer"
            >
              Dismiss QR
            </button>
          </div>
        </div>
      )}

      {/* Sync Status & Stats Toolbar */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200/70 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Sync Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Form ➔ Sheet'}</span>
          </button>

          <button
            onClick={onToggleAutoSync}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
              autoSyncActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {autoSyncActive ? (
              <>
                <Square className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                <span>Auto-Sync ON (Every 15s)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1" />
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-slate-500" />
                <span>Enable Live Auto-Sync</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenQuickMark}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition cursor-pointer ml-auto md:ml-0"
          >
            <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Quick Manual Entry</span>
          </button>
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-medium">Present:</span>
            <span className="font-bold">{presentCount}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="font-medium">Late:</span>
            <span className="font-bold">{lateCount}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="font-medium">OD:</span>
            <span className="font-bold">{excusedCount}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="font-medium">Absent:</span>
            <span className="font-bold">{absentCount}</span>
          </div>

          <div className="pl-2 border-l border-slate-200 text-slate-700 font-semibold">
            In Sheet: <span className="text-emerald-700">{totalMarked}</span>
          </div>
        </div>
      </div>

      {/* Real-time Sync Details Strip */}
      {lastSyncDetails && (
        <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Google Form Responses: <strong className="text-slate-800">{lastSyncDetails.formResponseCount}</strong>
              {' | '}
              Newly Added to Sheet: <strong className="text-emerald-700">{lastSyncDetails.newRowsAdded}</strong>
              {' | '}
              Already in Sheet: <strong className="text-slate-700">{lastSyncDetails.alreadyExisting}</strong>
            </span>
          </div>
          <span className="text-slate-400 font-mono">Last Checked: {lastSyncDetails.time}</span>
        </div>
      )}
    </div>
  );
};
