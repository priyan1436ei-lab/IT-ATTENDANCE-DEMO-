import React, { useState } from 'react';
import { RefreshCw, Play, Square, ExternalLink, QrCode, PlusCircle, Copy, Check, Info, Calendar, Plus, ChevronDown, Zap, Radio, Activity } from 'lucide-react';
import { AttendanceSession, AttendanceRecord, SheetRowData, SheetTabInfo } from '../types/attendance';

interface AttendanceSyncCardProps {
  session: AttendanceSession;
  records: AttendanceRecord[];
  sheetRecords: SheetRowData[];
  isSyncing: boolean;
  autoSyncActive: boolean;
  onToggleAutoSync: () => void;
  onManualSync: () => void;
  onOpenQuickMark: () => void;
  activeTabName?: string;
  availableTabs?: SheetTabInfo[];
  onSelectTab?: (tabName: string) => void;
  onOpenCreateTab?: () => void;
  transmissionSpeed?: number;
  onChangeTransmissionSpeed?: (seconds: number) => void;
  nextTransmitCountdown?: number;
  lastSyncDetails?: {
    time: string;
    formResponseCount: number;
    newRowsAdded: number;
    alreadyExisting: number;
    targetTab?: string;
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
  activeTabName = 'Attendance Records',
  availableTabs = [],
  onSelectTab,
  onOpenCreateTab,
  transmissionSpeed = 3,
  onChangeTransmissionSpeed,
  nextTransmitCountdown = 3,
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

      {/* Real-time Data Transmission Pulse Monitor Strip */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>REAL-TIME TRANSMIT LIVE</span>
          </div>

          <span className="text-slate-300 text-[11px] hidden sm:inline">
            Transmitting Google Form submissions ➔ Google Sheet tab <strong className="text-emerald-300 font-mono">[{activeTabName}]</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Transmission Speed Selector */}
          {onChangeTransmissionSpeed && (
            <div className="flex items-center gap-1 text-[11px] text-slate-300">
              <span className="hidden md:inline">Speed:</span>
              <div className="flex bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => onChangeTransmissionSpeed(3)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    transmissionSpeed === 3
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Transmit every 3 seconds"
                >
                  ⚡ 3s Turbo
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTransmissionSpeed(5)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    transmissionSpeed === 5
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Transmit every 5 seconds"
                >
                  5s Fast
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTransmissionSpeed(10)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    transmissionSpeed === 10
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Transmit every 10 seconds"
                >
                  10s
                </button>
              </div>
            </div>
          )}

          {/* Countdown indicator */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Cycle: {isSyncing ? 'Transmitting...' : `${nextTransmitCountdown}s`}</span>
          </div>
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

      {/* Date Sheet Tab Target Bar */}
      <div className="px-4 py-3 bg-emerald-50/50 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Target Google Sheet Tab:</span>
          </div>

          {availableTabs.length > 0 ? (
            <div className="relative">
              <select
                value={activeTabName}
                onChange={(e) => onSelectTab && onSelectTab(e.target.value)}
                className="text-xs font-bold text-emerald-900 bg-white border border-emerald-300 rounded-lg pl-3 pr-8 py-1.5 shadow-2xs outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none"
              >
                {availableTabs.map((t) => (
                  <option key={t.sheetId} value={t.title}>
                    {t.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-700 absolute right-2.5 top-2 pointer-events-none" />
            </div>
          ) : (
            <span className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-900 font-bold text-xs rounded-lg shadow-2xs font-mono">
              {activeTabName}
            </span>
          )}

          <span className="text-[11px] text-slate-500 hidden md:inline">
            (All real-time submissions & manual entries transmit directly to this tab)
          </span>
        </div>

        {/* Next Day Tab Quick Creation Button */}
        {onOpenCreateTab && (
          <button
            onClick={onOpenCreateTab}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition shadow-2xs cursor-pointer self-start sm:self-auto"
            title="Create a new tab in this Google Sheet for next day or specific date"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>+ Create Next Day Tab</span>
          </button>
        )}
      </div>

      {/* Sync Status & Stats Toolbar */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200/70 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Sync Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs disabled:opacity-50 cursor-pointer"
            title={`Force instant transmission to tab: ${activeTabName}`}
          >
            <Zap className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce text-amber-300' : 'text-amber-300'}`} />
            <span>{isSyncing ? 'Transmitting Data...' : `Transmit Now ➔ ${activeTabName}`}</span>
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
                <span>Real-Time Stream Active</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1" />
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-slate-500" />
                <span>Resume Real-Time Stream</span>
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

        {/* Live Counters for Active Tab */}
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
            In {activeTabName}: <span className="text-emerald-700">{totalMarked}</span>
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
              Newly Transmitted to <span className="font-mono font-bold text-emerald-800">{lastSyncDetails.targetTab || activeTabName}</span>: <strong className="text-emerald-700">{lastSyncDetails.newRowsAdded}</strong>
              {' | '}
              Already in Tab: <strong className="text-slate-700">{lastSyncDetails.alreadyExisting}</strong>
            </span>
          </div>
          <span className="text-slate-400 font-mono">Last Transmit: {lastSyncDetails.time}</span>
        </div>
      )}
    </div>
  );
};
