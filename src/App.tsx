import React, { useState, useEffect, useRef } from 'react';
import { AuthBar } from './components/AuthBar';
import { RoleLoginPage } from './components/RoleLoginPage';
import { StudentPortalView } from './components/StudentPortalView';
import { CreateSessionModal } from './components/CreateSessionModal';
import { AttendanceSyncCard } from './components/AttendanceSyncCard';
import { SheetTableView } from './components/SheetTableView';
import { QuickMarkModal } from './components/QuickMarkModal';
import { RosterManager } from './components/RosterManager';
import { workspaceService } from './services/workspace';
import { initAuth } from './services/firebaseAuth';
import { storage } from './services/storage';
import { AttendanceSession, AttendanceRecord, SheetRowData, StudentProfile, AppUserSession } from './types/attendance';
import { Plus, Sparkles, FileText, Table, CheckCircle2, AlertCircle, BookOpen, Link2, Shield, GraduationCap, LogOut, User } from 'lucide-react';

export default function App() {
  // App Role Authentication (Student or Admin)
  const [currentAppUser, setCurrentAppUser] = useState<AppUserSession | null>(() => storage.getCurrentUser());

  // Google Workspace OAuth State
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
  const [syncDetails, setSyncDetails] = useState<{
    time: string;
    formResponseCount: number;
    newRowsAdded: number;
    alreadyExisting: number;
  } | null>(null);

  const [roster, setRoster] = useState<StudentProfile[]>(() => storage.getRoster());

  // Auto-sync timer ref
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Firebase Auth listener on app load
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
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

  // Handle auto-sync interval (for admin only)
  useEffect(() => {
    if (
      currentAppUser?.role === 'admin' &&
      autoSyncActive &&
      activeSession?.formId &&
      activeSession?.spreadsheetId &&
      isAuthenticated
    ) {
      runSyncWorkflow(activeSession);

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
  }, [autoSyncActive, activeSession, isAuthenticated, currentAppUser]);

  const handleRoleLogin = (user: AppUserSession) => {
    setCurrentAppUser(user);
  };

  const handleRoleLogout = () => {
    storage.setCurrentUser(null);
    setCurrentAppUser(null);
    setAutoSyncActive(false);
  };

  const handleGoogleLogin = async () => {
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
      setAuthErrorMessage(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
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

      const timeNow = new Date().toLocaleTimeString();
      setSyncDetails({
        time: timeNow,
        formResponseCount: rawResponses.length,
        newRowsAdded: result.insertedCount,
        alreadyExisting: result.alreadyExistingCount
      });

      const msg =
        result.insertedCount > 0
          ? `✓ Google Sheet Updated! Added ${result.insertedCount} new student submission(s).`
          : `✓ Sync complete: Form has ${rawResponses.length} response(s), all up to date in Google Sheet.`;
      setSyncStatusMsg(msg);

      // Update session timestamp
      const updated = { ...session, lastSyncAt: new Date().toISOString() };
      storage.updateSession(updated);
      setActiveSession(updated);

      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncStatusMsg(`Sync notice: ${err.message || 'Error communicating with Google Forms/Sheets'}`);
      setTimeout(() => setSyncStatusMsg(null), 6000);
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

  // 1. If not logged in as Student or Admin, show RoleLoginPage
  if (!currentAppUser) {
    return <RoleLoginPage onLoginSuccess={handleRoleLogin} />;
  }

  const isAdmin = currentAppUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Application Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm font-bold text-lg ${
                isAdmin
                  ? 'bg-gradient-to-tr from-slate-900 to-slate-700'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-500'
              }`}
            >
              {isAdmin ? <Shield className="w-5 h-5 text-amber-300" /> : <GraduationCap className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Class Attendance Sync
                </h1>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                    isAdmin
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isAdmin ? '🛡️ Admin Portal' : '🎓 Student Portal'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isAdmin
                  ? 'Google Forms & Google Sheets Attendance Management'
                  : `Signed in: ${currentAppUser.name} (${currentAppUser.identifier})`}
              </p>
            </div>
          </div>

          {/* User Controls & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-700 max-w-[130px] truncate">
                {currentAppUser.name}
              </span>
            </div>

            <button
              onClick={handleRoleLogout}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition cursor-pointer font-medium"
              title="Logout from portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* STUDENT PORTAL VIEW */}
        {!isAdmin ? (
          <StudentPortalView
            currentUser={currentAppUser}
            activeSession={activeSession}
            sheetRecords={sheetRecords}
            onOpenForm={() => {
              if (activeSession?.formResponderUri) {
                window.open(activeSession.formResponderUri, '_blank');
              }
            }}
          />
        ) : (
          /* ADMIN PORTAL VIEW */
          <>
            {/* Google Workspace Connection Banner for Admin */}
            {!isAuthenticated ? (
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">
                      Google Workspace Connection Required (Admin)
                    </h3>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Connect your Google Account to authorize reading Form responses and updating your Google Sheet.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  disabled={isAuthLoading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{isAuthLoading ? 'Connecting...' : 'Connect Google Workspace'}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Google Workspace Connected: {userInfo?.email || 'Authorized'}</span>
                </div>
                <button
                  onClick={handleGoogleLogout}
                  className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                >
                  Disconnect Google
                </button>
              </div>
            )}

            {/* Sync Notification Toast */}
            {syncStatusMsg && (
              <div className="p-3 bg-emerald-900 text-emerald-100 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium">{syncStatusMsg}</span>
                </div>
                <button
                  onClick={() => setSyncStatusMsg(null)}
                  className="text-emerald-300 hover:text-white cursor-pointer ml-3"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Session Switcher & Link Form Header */}
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
                  <span className="text-xs text-slate-400 italic">No class connected yet</span>
                )}
              </div>

              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition cursor-pointer"
              >
                <Link2 className="w-4 h-4 text-emerald-400" />
                <span>Link Google Form & Sheet</span>
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
                  lastSyncDetails={syncDetails}
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
                    <span>Student Roster ({roster.length} Students)</span>
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
                    <span>How Sync Works</span>
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
                  <RosterManager roster={roster} onUpdateRoster={handleUpdateRoster} isAdmin={isAdmin} />
                )}

                {activeTab === 'guide' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">
                        How Google Form ➔ Google Sheet Sync Works:
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed mb-4">
                        Automatic workflow to synchronize student attendance from your Google Form into your Google Sheets register.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center">
                            1
                          </div>
                          <h4 className="font-bold text-slate-800">1. Share Form or Classroom QR</h4>
                          <p className="text-slate-600">
                            Provide the <span className="font-semibold text-purple-700">"Student Form Link"</span> or project the <span className="font-semibold text-slate-800">"Classroom QR"</span> code so students can submit attendance.
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
                            2
                          </div>
                          <h4 className="font-bold text-slate-800">2. Real-Time Auto-Sync</h4>
                          <p className="text-slate-600">
                            Enable <span className="font-semibold text-emerald-700">"Live Auto-Sync"</span> to automatically fetch new responses via Google Forms API every 15 seconds and append them to your spreadsheet.
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                            3
                          </div>
                          <h4 className="font-bold text-slate-800">3. Direct Google Sheet Update</h4>
                          <p className="text-slate-600">
                            Click <span className="font-semibold text-emerald-700">"Open Google Sheet"</span> at any time to inspect your live spreadsheet in Google Drive.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <p className="font-bold">✨ Direct Links for this Class:</p>
                      <p>
                        • Form Link:{' '}
                        <a
                          href={activeSession.formResponderUri}
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-mono"
                        >
                          {activeSession.formResponderUri}
                        </a>
                      </p>
                      <p>
                        • Google Sheet Link:{' '}
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
                  Provide your Google Form and Google Sheet URLs to link a class session.
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Link Google Form & Google Sheet</span>
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
