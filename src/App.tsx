import React, { useState, useEffect, useRef } from 'react';
import { AuthBar } from './components/AuthBar';
import { CreateSessionModal } from './components/CreateSessionModal';
import { AttendanceSyncCard } from './components/AttendanceSyncCard';
import { SheetTableView } from './components/SheetTableView';
import { QuickMarkModal } from './components/QuickMarkModal';
import { RosterManager } from './components/RosterManager';
import { workspaceService } from './services/workspace';
import { initAuth, auth } from './services/firebaseAuth';
import { storage } from './services/storage';
import { AttendanceSession, AttendanceRecord, SheetRowData, StudentProfile } from './types/attendance';
import { Plus, Sparkles, FileText, Table, CheckCircle2, AlertCircle, ArrowRight, BookOpen, Clock, Activity, ExternalLink, ShieldCheck } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(workspaceService.isAuthenticated());
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; picture?: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<AttendanceSession[]>(() => storage.getSessions());
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(() => {
    const list = storage.getSessions();
    return list.length > 0 ? list[0] : null;
  });

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQuickMarkOpen, setIsQuickMarkOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sheet' | 'roster' | 'guide'>('sheet');

  // Attendance Data
  const [sheetRecords, setSheetRecords] = useState<SheetRowData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncActive, setAutoSyncActive] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [roster, setRoster] = useState<StudentProfile[]>(() => storage.getRoster());

  // Auto-sync timer ref
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Firebase Auth listener on app load
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setIsAuthenticated(true);
        setUserInfo({
          name: user.displayName || 'Authorized User',
          email: user.email || '',
          picture: user.photoURL || undefined
        });
        setAuthErrorMessage(null);
      },
      () => {
        setIsAuthenticated(false);
        setUserInfo(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // When active session changes, load sheet records
  useEffect(() => {
    if (activeSession?.spreadsheetId && isAuthenticated) {
      loadSheetRecords(activeSession.spreadsheetId);
    }
  }, [activeSession, isAuthenticated]);

  // Handle auto-sync interval
  useEffect(() => {
    if (autoSyncActive && activeSession?.formId && activeSession?.spreadsheetId && isAuthenticated) {
      // Run once immediately
      runSyncWorkflow(activeSession);

      // Interval 15 seconds
      autoSyncIntervalRef.current = setInterval(() => {
        runSyncWorkflow(activeSession);
      }, 15000);
    } else {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [autoSyncActive, activeSession, isAuthenticated]);

  const handleLogin = async () => {
    setIsAuthLoading(true);
    setAuthErrorMessage(null);
    try {
      await workspaceService.login();
      setIsAuthenticated(true);
      const profile = await workspaceService.getUserProfile();
      if (profile) setUserInfo(profile);
    } catch (err: any) {
      console.warn('Sign in interaction cancelled or failed:', err);
      const msg = err?.message || 'Login was not completed. Please try again.';
      // User-friendly inline notification instead of harsh alert()
      setAuthErrorMessage(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await workspaceService.logout();
    setIsAuthenticated(false);
    setUserInfo(null);
    setAutoSyncActive(false);
    setAuthErrorMessage(null);
  };

  const loadSheetRecords = async (spreadsheetId: string) => {
    try {
      const records = await workspaceService.getSheetRecords(spreadsheetId);
      setSheetRecords(records);
    } catch (err) {
      console.error('Error fetching sheet records:', err);
    }
  };

  /**
   * CORE WORKFLOW:
   * 1. Read Google Form responses submitted by students
   * 2. Parse responses into attendance objects (Roll Number, Name, Status, Remarks)
   * 3. Sync & append to Google Sheet register without duplicating existing rows
   */
  const runSyncWorkflow = async (session: AttendanceSession) => {
    if (!session.formId || !session.spreadsheetId || !isAuthenticated) return;
    setIsSyncing(true);
    try {
      const [formDetails, rawResponses] = await Promise.all([
        workspaceService.getFormDetails(session.formId),
        workspaceService.getFormResponses(session.formId)
      ]);

      const parsed = workspaceService.parseResponses(formDetails, rawResponses, session.subject);

      // Append new responses to Google Sheet
      const result = await workspaceService.appendRecordsToSheet(
        session.spreadsheetId,
        parsed,
        session.sheetName || 'Attendance Records'
      );

      // Reload fresh rows from sheet
      await loadSheetRecords(session.spreadsheetId);

      const msg = result.insertedCount > 0
        ? `Synced ${result.insertedCount} new student submission(s) into Google Sheet!`
        : `All submissions up to date (${rawResponses.length} total Form responses).`;
      setSyncStatusMsg(msg);

      // Update session timestamp
      const updated = { ...session, lastSyncAt: new Date().toISOString() };
      storage.updateSession(updated);
      setActiveSession(updated);

      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncStatusMsg(`Sync notice: ${err.message || 'Error communicating with Google'}`);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateSession = (newSession: AttendanceSession) => {
    storage.addSession(newSession);
    setSessions(storage.getSessions());
    setActiveSession(newSession);
    setSheetRecords([]);
  };

  const handleQuickMark = async (student: {
    rollNumber: string;
    name: string;
    status: 'Present' | 'Absent' | 'Late' | 'Excused';
    notes: string;
  }) => {
    if (!activeSession?.spreadsheetId) return;

    const record: AttendanceRecord = {
      responseId: 'manual_' + Date.now(),
      timestamp: new Date().toISOString(),
      studentName: student.name,
      rollNumber: student.rollNumber,
      status: student.status,
      sessionName: activeSession.subject,
      notes: student.notes,
      syncedToSheet: true
    };

    await workspaceService.addManualRecordToSheet(activeSession.spreadsheetId, record);
    await loadSheetRecords(activeSession.spreadsheetId);
  };

  const handleUpdateRoster = (newRoster: StudentProfile[]) => {
    setRoster(newRoster);
    storage.saveRoster(newRoster);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Google Workspace Auth Bar */}
      <AuthBar
        isAuthenticated={isAuthenticated}
        userInfo={userInfo}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoading={isAuthLoading}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Auth Error Banner if popup was closed or cancelled */}
        {authErrorMessage && !isAuthenticated && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Sign-in notice:</strong> {authErrorMessage} Click{' '}
                <button
                  onClick={handleLogin}
                  className="underline font-semibold text-amber-900 hover:text-black cursor-pointer"
                >
                  here to retry
                </button>
                .
              </span>
            </div>
            <button
              onClick={() => setAuthErrorMessage(null)}
              className="text-amber-600 hover:text-amber-800 p-1 font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sync notification toast */}
        {syncStatusMsg && (
          <div className="p-3 bg-emerald-900 text-emerald-100 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-medium">{syncStatusMsg}</span>
            </div>
            <button onClick={() => setSyncStatusMsg(null)} className="text-emerald-300 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {!isAuthenticated ? (
          /* Unauthenticated Landing / Call To Action */
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 sm:p-12 text-center max-w-2xl mx-auto my-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white mx-auto shadow-md mb-6">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
              Class Attendance: Google Form ➔ Google Sheet Sync
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              When students submit attendance on Google Form, it automatically populates your official Google Sheets attendance register in real time.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 text-left space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Instant Google Form generation with Roll Number, Name & Status questions</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Structured Google Sheet with formatted columns, frozen headers & duplicate protection</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Live background auto-sync every 15s or on-demand instant sync</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Classroom QR code projector for students to scan and mark attendance</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleLogin}
                disabled={isAuthLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-md transition hover:shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAuthLoading ? 'Opening Google Sign-In...' : 'Connect Google Workspace & Get Started'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Uses official Google Workspace OAuth to create and sync your Google Forms & Google Sheets.
            </p>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <>
            {/* Session Switcher & Create Session Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate-500">Active Class:</label>
                {sessions.length > 0 ? (
                  <select
                    value={activeSession?.id || ''}
                    onChange={(e) => {
                      const found = sessions.find((s) => s.id === e.target.value);
                      if (found) {
                        setActiveSession(found);
                        setAutoSyncActive(false);
                      }
                    }}
                    className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject} ({s.date})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-400 italic">No class created yet</span>
                )}
              </div>

              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Create New Class Attendance</span>
              </button>
            </div>

            {/* Active Session Display */}
            {activeSession ? (
              <div className="space-y-5">
                <AttendanceSyncCard
                  session={activeSession}
                  records={[]}
                  sheetRecords={sheetRecords}
                  isSyncing={isSyncing}
                  autoSyncActive={autoSyncActive}
                  onToggleAutoSync={() => setAutoSyncActive(!autoSyncActive)}
                  onManualSync={() => runSyncWorkflow(activeSession)}
                  onOpenQuickMark={() => setIsQuickMarkOpen(true)}
                />

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('sheet')}
                    className={`pb-2.5 flex items-center gap-1.5 transition cursor-pointer ${
                      activeTab === 'sheet'
                        ? 'border-b-2 border-emerald-600 text-emerald-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Table className="w-4 h-4" />
                    <span>Live Google Sheet Records ({sheetRecords.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('roster')}
                    className={`pb-2.5 flex items-center gap-1.5 transition cursor-pointer ${
                      activeTab === 'roster'
                        ? 'border-b-2 border-emerald-600 text-emerald-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Class Roster ({roster.length} Students)</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('guide')}
                    className={`pb-2.5 flex items-center gap-1.5 transition cursor-pointer ${
                      activeTab === 'guide'
                        ? 'border-b-2 border-emerald-600 text-emerald-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>How Sync Works (Tamil & English Guide)</span>
                  </button>
                </div>

                {/* Tab Contents */}
                {activeTab === 'sheet' && (
                  <SheetTableView
                    records={sheetRecords}
                    spreadsheetUrl={activeSession.spreadsheetUrl}
                    isLoading={isSyncing}
                    onRefresh={() => loadSheetRecords(activeSession.spreadsheetId!)}
                  />
                )}

                {activeTab === 'roster' && (
                  <RosterManager roster={roster} onUpdateRoster={handleUpdateRoster} />
                )}

                {activeTab === 'guide' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">
                        How Google Form ➔ Google Sheet Attendance Sync Works:
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed mb-4">
                        (Google Form-la attendance potta, Google Sheet-la automatic-ah update aaga intha app help pannuthu)
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center">
                            1
                          </div>
                          <h4 className="font-bold text-slate-800">1. Share Form or QR Code</h4>
                          <p className="text-slate-600">
                            Click <span className="font-semibold text-purple-700">"Share Form"</span> or open <span className="font-semibold text-slate-800">"Classroom QR"</span> to display on classroom projector or WhatsApp group. Students fill Roll No, Name, and Status.
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
                            2
                          </div>
                          <h4 className="font-bold text-slate-800">2. Real-Time Auto-Sync</h4>
                          <p className="text-slate-600">
                            Switch ON <span className="font-semibold text-emerald-700">"Live Auto-Sync"</span>. The app reads submissions every 15 seconds from Google Forms API and appends new rows into the linked Google Sheet.
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                            3
                          </div>
                          <h4 className="font-bold text-slate-800">3. Google Sheet Register & Summary</h4>
                          <p className="text-slate-600">
                            Your Google Sheet contains <span className="font-semibold">"Attendance Records"</span> and <span className="font-semibold">"Daily Summary"</span> with percentage calculations and duplicate protection.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <p className="font-bold">✨ Direct Links for this Class:</p>
                      <p>
                        • Form Edit URL:{' '}
                        <a
                          href={activeSession.formEditUri}
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-mono"
                        >
                          {activeSession.formEditUri}
                        </a>
                      </p>
                      <p>
                        • Google Sheet URL:{' '}
                        <a
                          href={activeSession.spreadsheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-mono"
                        >
                          {activeSession.spreadsheetUrl}
                        </a>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">No Attendance Session Selected</h3>
                <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                  Click the button below to generate a new Google Form and Google Sheet register for today's class.
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Class Attendance Session</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <CreateSessionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreateSession}
      />

      <QuickMarkModal
        isOpen={isQuickMarkOpen}
        onClose={() => setIsQuickMarkOpen(false)}
        roster={roster}
        onMarkAttendance={handleQuickMark}
      />
    </div>
  );
}
