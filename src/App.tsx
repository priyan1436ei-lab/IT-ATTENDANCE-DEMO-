import React, { useState, useEffect, useRef } from 'react';
import { RoleLoginPage } from './components/RoleLoginPage';
import { StudentPortalView } from './components/StudentPortalView';
import { CreateSessionModal } from './components/CreateSessionModal';
import { CreateDateTabModal } from './components/CreateDateTabModal';
import { AttendanceSyncCard } from './components/AttendanceSyncCard';
import { SheetTableView } from './components/SheetTableView';
import { QuickMarkModal } from './components/QuickMarkModal';
import { RosterManager } from './components/RosterManager';
import { workspaceService } from './services/workspace';
import { initAuth } from './services/firebaseAuth';
import { storage } from './services/storage';
import { AttendanceSession, AttendanceRecord, SheetRowData, StudentProfile, AppUserSession, SheetTabInfo } from './types/attendance';
import { Plus, Sparkles, FileText, Table, CheckCircle2, AlertCircle, BookOpen, Link2, Shield, GraduationCap, LogOut, User, Zap } from 'lucide-react';

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

  // Date Sheet Tabs
  const [availableTabs, setAvailableTabs] = useState<SheetTabInfo[]>([]);
  const [activeTabName, setActiveTabName] = useState<string>(() => {
    return activeSession?.activeTab || activeSession?.sheetName || new Date().toISOString().split('T')[0];
  });
  const [isCreateDateTabOpen, setIsCreateDateTabOpen] = useState(false);
  const [isCreatingTab, setIsCreatingTab] = useState(false);

  // Real-Time Transmission Controls
  const [transmissionSpeed, setTransmissionSpeed] = useState<number>(3); // 3s real-time turbo stream
  const [countdown, setCountdown] = useState<number>(3);

  // Modals & Navigation
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQuickMarkOpen, setIsQuickMarkOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sheet' | 'roster' | 'guide'>('sheet');

  // Attendance Data
  const [sheetRecords, setSheetRecords] = useState<SheetRowData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncActive, setAutoSyncActive] = useState(true); // Default to live stream ON
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [syncDetails, setSyncDetails] = useState<{
    time: string;
    formResponseCount: number;
    newRowsAdded: number;
    alreadyExisting: number;
    targetTab?: string;
  } | null>(null);

  // Class Roster
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

  // When active session or auth changes, automatically ensure today's tab exists and load records
  useEffect(() => {
    if (activeSession?.spreadsheetId && isAuthenticated) {
      loadTabsAndRecords(activeSession.spreadsheetId);
    }
  }, [activeSession?.id, isAuthenticated]);

  // Live countdown ticker for real-time data transmission
  useEffect(() => {
    if (!autoSyncActive) return;
    const ticker = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? transmissionSpeed : prev - 1));
    }, 1000);
    return () => clearInterval(ticker);
  }, [autoSyncActive, transmissionSpeed]);

  // Immediate transmission whenever window/tab receives focus
  useEffect(() => {
    const handleWindowFocus = () => {
      if (activeSession && isAuthenticated) {
        if (currentAppUser?.role === 'admin') {
          runSyncWorkflow(activeSession, activeTabName);
        } else {
          loadSheetRecords(activeSession.spreadsheetId, activeTabName);
        }
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [activeSession, isAuthenticated, currentAppUser?.role, activeTabName]);

  // Continuous real-time data transmission loop
  useEffect(() => {
    if (!autoSyncActive || !activeSession?.spreadsheetId) {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
      return;
    }

    const intervalMs = transmissionSpeed * 1000;

    if (currentAppUser?.role === 'admin' && activeSession.formId && isAuthenticated) {
      // Admin: Stream Google Form responses ➔ Sheet tab ➔ App
      runSyncWorkflow(activeSession, activeTabName);

      autoSyncIntervalRef.current = setInterval(() => {
        runSyncWorkflow(activeSession, activeTabName);
      }, intervalMs);
    } else if (currentAppUser?.role === 'student' && isAuthenticated) {
      // Student: Stream live sheet rows into portal
      loadSheetRecords(activeSession.spreadsheetId, activeTabName);

      autoSyncIntervalRef.current = setInterval(() => {
        loadSheetRecords(activeSession.spreadsheetId, activeTabName);
      }, intervalMs);
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [autoSyncActive, activeSession, isAuthenticated, currentAppUser?.role, activeTabName, transmissionSpeed]);

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
      if (activeSession?.spreadsheetId) {
        loadTabsAndRecords(activeSession.spreadsheetId);
      }
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

  /**
   * AUTOMATIC DATE TAB LIFECYCLE:
   * 1. Inspect Google Sheet tabs
   * 2. If today's date tab does not exist, automatically duplicates the template/previous tab!
   * 3. Sets today's tab as active and loads records
   */
  const loadTabsAndRecords = async (spreadsheetId: string) => {
    try {
      // Auto-ensure today's date tab is duplicated and ready
      const todayResult = await workspaceService.ensureTodayDateTab(spreadsheetId);
      const tabs = await workspaceService.getSheetTabs(spreadsheetId);
      setAvailableTabs(tabs);

      const targetTab = todayResult.tab.title;
      setActiveTabName(targetTab);
      await loadSheetRecords(spreadsheetId, targetTab);

      if (todayResult.wasCreated) {
        setSyncStatusMsg(`✨ Automatically created & duplicated date tab "${targetTab}" in Google Sheet!`);
        setTimeout(() => setSyncStatusMsg(null), 6000);
      }
    } catch (err) {
      console.warn('Could not auto-ensure date tab, falling back to direct sheet read:', err);
      await loadSheetRecords(spreadsheetId, activeTabName);
    }
  };

  /**
   * Load rows for a specific date tab
   */
  const loadSheetRecords = async (spreadsheetId: string, tabName?: string) => {
    const target = tabName || activeTabName || 'Attendance Records';
    try {
      const records = await workspaceService.getSheetRecords(spreadsheetId, target);
      setSheetRecords(records);
    } catch (err) {
      console.error(`Error fetching sheet records from tab "${target}":`, err);
    }
  };

  /**
   * Switch between Date Tabs
   */
  const handleSelectTab = async (tabName: string) => {
    setActiveTabName(tabName);
    if (activeSession?.spreadsheetId) {
      await loadSheetRecords(activeSession.spreadsheetId, tabName);
      // Persist active tab selection
      const updated = { ...activeSession, activeTab: tabName };
      storage.updateSession(updated);
      setActiveSession(updated);
    }
  };

  /**
   * Manual override creation if teacher wants to pre-create a tab
   */
  const handleCreateDateTab = async (newTabName: string, copyFromSheetId?: number) => {
    if (!activeSession?.spreadsheetId || !isAuthenticated) {
      throw new Error('Google Workspace is not connected or no class session is active.');
    }

    setIsCreatingTab(true);
    try {
      const newTab = await workspaceService.createDateTab(activeSession.spreadsheetId, {
        newTabName,
        copyFromSheetId,
        clearCopiedRows: true
      });

      // Refresh tabs list
      const tabs = await workspaceService.getSheetTabs(activeSession.spreadsheetId);
      setAvailableTabs(tabs);

      // Switch to the newly created tab
      setActiveTabName(newTab.title);
      await loadSheetRecords(activeSession.spreadsheetId, newTab.title);

      // Save to active session
      const updated = { ...activeSession, activeTab: newTab.title, date: newTabName };
      storage.updateSession(updated);
      setActiveSession(updated);

      setSyncStatusMsg(`✓ Tab "${newTab.title}" duplicated in Google Sheet! Submissions & attendance will now save into this date's tab.`);
      setTimeout(() => setSyncStatusMsg(null), 6000);
    } finally {
      setIsCreatingTab(false);
    }
  };

  /**
   * REAL-TIME TRANSMISSION WORKFLOW:
   * 1. Auto-checks if today's tab exists (auto-duplicates if a new day has arrived)
   * 2. Reads Google Form responses submitted by students
   * 3. Parses responses into structured attendance
   * 4. Appends to target date tab in Google Sheet without duplicates
   * 5. Instantly reflects the live records in the UI table
   */
  const runSyncWorkflow = async (session: AttendanceSession, targetTabName?: string) => {
    if (!session.formId || !session.spreadsheetId || !isAuthenticated) return;
    setIsSyncing(true);

    try {
      // Auto-check if today's date tab exists in Google Sheet
      const autoDay = await workspaceService.ensureTodayDateTab(session.spreadsheetId);
      if (autoDay.wasCreated) {
        const tabs = await workspaceService.getSheetTabs(session.spreadsheetId);
        setAvailableTabs(tabs);
      }

      const targetTab = targetTabName || autoDay.tab.title || activeTabName || 'Attendance Records';

      const [formDetails, rawResponses] = await Promise.all([
        workspaceService.getFormDetails(session.formId),
        workspaceService.getFormResponses(session.formId)
      ]);

      const parsed = workspaceService.parseResponses(formDetails, rawResponses, session.subject);

      // Transmit new responses to Google Sheet for this active tab
      const result = await workspaceService.appendRecordsToSheet(
        session.spreadsheetId,
        parsed,
        targetTab
      );

      // Reload fresh rows from sheet
      await loadSheetRecords(session.spreadsheetId, targetTab);

      const timeNow = new Date().toLocaleTimeString();
      setSyncDetails({
        time: timeNow,
        formResponseCount: rawResponses.length,
        newRowsAdded: result.insertedCount,
        alreadyExisting: result.alreadyExistingCount,
        targetTab
      });

      if (result.insertedCount > 0) {
        setSyncStatusMsg(`⚡ Real-Time Transmit: Added ${result.insertedCount} new student submission(s) into Google Sheet [${targetTab}]!`);
        setTimeout(() => setSyncStatusMsg(null), 4000);
      }

      // Update session timestamp
      const updated = { ...session, lastSyncAt: new Date().toISOString(), activeTab: targetTab };
      storage.updateSession(updated);
      setActiveSession(updated);
    } catch (err: any) {
      console.error('Real-time transmit failed:', err);
    } finally {
      setIsSyncing(false);
      setCountdown(transmissionSpeed);
    }
  };

  const handleCreateSession = (newSession: AttendanceSession) => {
    storage.addSession(newSession);
    setSessions(storage.getSessions());
    setActiveSession(newSession);
    setActiveTabName(newSession.sheetName || new Date().toISOString().split('T')[0]);
    setSheetRecords([]);
    if (newSession.spreadsheetId && isAuthenticated) {
      loadTabsAndRecords(newSession.spreadsheetId);
    }
  };

  /**
   * Manual Attendance by Admin
   * 0ms Optimistic UI + Direct transmission to Google Sheet date tab!
   */
  const handleQuickMark = async (student: {
    rollNumber: string;
    name: string;
    status: 'Present' | 'Absent' | 'Late' | 'Excused';
    notes: string;
  }) => {
    if (!activeSession?.spreadsheetId) return;

    const record: AttendanceRecord = {
      responseId: 'manual_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      studentName: student.name,
      rollNumber: student.rollNumber,
      status: student.status,
      sessionName: activeSession.subject,
      notes: student.notes || 'Admin manual entry',
      syncedToSheet: true
    };

    // 0ms Optimistic UI update
    setSheetRecords((prev) => {
      const exists = prev.some((r) => r.rollNumber.toUpperCase() === student.rollNumber.toUpperCase());
      if (exists) {
        return prev.map((r) =>
          r.rollNumber.toUpperCase() === student.rollNumber.toUpperCase()
            ? { ...r, status: student.status, timestamp: new Date().toLocaleTimeString(), notes: student.notes }
            : r
        );
      }
      return [
        {
          rowNumber: prev.length + 2,
          timestamp: new Date().toLocaleTimeString(),
          rollNumber: student.rollNumber,
          name: student.name,
          status: student.status,
          session: activeSession.subject,
          notes: student.notes || 'Manual Entry'
        },
        ...prev
      ];
    });

    // Real-time background transmission to Google Sheet
    await workspaceService.addManualRecordToSheet(activeSession.spreadsheetId, record, activeTabName);

    // Refresh rows
    await loadSheetRecords(activeSession.spreadsheetId, activeTabName);

    if (activeSession.formId) {
      runSyncWorkflow(activeSession, activeTabName);
    }
  };

  /**
   * Direct Student Self Check-in from Student Portal
   * 0ms Optimistic UI + Direct transmission to Google Sheet date tab!
   */
  const handleStudentSelfMark = async () => {
    if (!activeSession?.spreadsheetId || !currentAppUser) return;

    const studentProfile = roster.find(
      (r) => r.rollNumber.trim().toUpperCase() === currentAppUser.identifier.trim().toUpperCase()
    );
    const studentName = studentProfile?.name || currentAppUser.name;
    const studentRoll = currentAppUser.identifier;

    const record: AttendanceRecord = {
      responseId: 'portal_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      studentName,
      rollNumber: studentRoll,
      status: 'Present',
      sessionName: activeSession.subject,
      notes: 'Marked in Student Portal',
      syncedToSheet: true
    };

    // 0ms Optimistic UI update
    setSheetRecords((prev) => {
      const exists = prev.some((r) => r.rollNumber.toUpperCase() === studentRoll.toUpperCase());
      if (exists) {
        return prev.map((r) =>
          r.rollNumber.toUpperCase() === studentRoll.toUpperCase()
            ? { ...r, status: 'Present', timestamp: new Date().toLocaleTimeString() }
            : r
        );
      }
      return [
        {
          rowNumber: prev.length + 2,
          timestamp: new Date().toLocaleTimeString(),
          rollNumber: studentRoll,
          name: studentName,
          status: 'Present',
          session: activeSession.subject,
          notes: 'Marked in Student Portal'
        },
        ...prev
      ];
    });

    // Transmit to Google Sheet date tab
    await workspaceService.addManualRecordToSheet(activeSession.spreadsheetId, record, activeTabName);

    // Refresh sheet rows
    await loadSheetRecords(activeSession.spreadsheetId, activeTabName);
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
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>Real-Time Transmit ({transmissionSpeed}s)</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isAdmin
                  ? 'Live Google Forms & Google Sheets Attendance Streaming'
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
            availableTabs={availableTabs}
            activeTabName={activeTabName}
            onSelectTab={handleSelectTab}
            onSelfMarkAttendance={handleStudentSelfMark}
            isSyncing={isSyncing}
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
                      Connect your Google Account once to authorize real-time data transmission between Google Forms and Google Sheets.
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
              <div className="flex flex-wrap items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 gap-2">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Google Workspace Connected: <strong>{userInfo?.email || 'Authorized'}</strong></span>
                  <span className="text-slate-400">•</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Real-Time Stream Active ({transmissionSpeed}s interval)</span>
                  </span>
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
              <div className="p-3 bg-slate-900 text-emerald-300 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300 border border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                  <span className="font-semibold text-white">{syncStatusMsg}</span>
                </div>
                <button
                  onClick={() => setSyncStatusMsg(null)}
                  className="text-slate-400 hover:text-white cursor-pointer ml-3"
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
                        if (found.spreadsheetId && isAuthenticated) {
                          loadTabsAndRecords(found.spreadsheetId);
                        }
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
                  onManualSync={() => runSyncWorkflow(activeSession, activeTabName)}
                  onOpenQuickMark={() => setIsQuickMarkOpen(true)}
                  activeTabName={activeTabName}
                  availableTabs={availableTabs}
                  onSelectTab={handleSelectTab}
                  onOpenCreateTab={() => setIsCreateDateTabOpen(true)}
                  transmissionSpeed={transmissionSpeed}
                  onChangeTransmissionSpeed={setTransmissionSpeed}
                  nextTransmitCountdown={countdown}
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
                    <span>Real-Time Architecture</span>
                  </button>
                </div>

                {/* Tab Contents */}
                {activeTab === 'sheet' && (
                  <SheetTableView
                    records={sheetRecords}
                    spreadsheetUrl={activeSession.spreadsheetUrl}
                    isLoading={isSyncing}
                    onRefresh={() => loadSheetRecords(activeSession.spreadsheetId!, activeTabName)}
                    availableTabs={availableTabs}
                    activeTabName={activeTabName}
                    onSelectTab={handleSelectTab}
                    onOpenCreateTab={() => setIsCreateDateTabOpen(true)}
                  />
                )}

                {activeTab === 'roster' && (
                  <RosterManager roster={roster} onUpdateRoster={handleUpdateRoster} isAdmin={isAdmin} />
                )}

                {activeTab === 'guide' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">
                        Real-Time Attendance Data Transmission Pipeline:
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed mb-4">
                        Data transmits in real-time across Google Forms, Google Sheets, and the web application.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
                            ⚡
                          </div>
                          <h4 className="font-bold text-slate-800">1. 3-Second Turbo Stream</h4>
                          <p className="text-slate-600">
                            The system continuously polls Google Forms and Google Sheets with zero-cache headers, transmitting submissions into your spreadsheet every 3 seconds.
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center">
                            🚀
                          </div>
                          <h4 className="font-bold text-slate-800">2. 0ms Optimistic Reflection</h4>
                          <p className="text-slate-600">
                            When an admin marks attendance or a student self checks-in, the UI renders immediately in 0 milliseconds while simultaneously transmitting the row into Google Sheets.
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                            📑
                          </div>
                          <h4 className="font-bold text-slate-800">3. Automatic Daily Tabs</h4>
                          <p className="text-slate-600">
                            Every day, the system automatically checks and creates that day's sheet tab in Google Sheets, ensuring real-time data always lands in the right day's register.
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
        activeTabName={activeTabName}
        onMarkAttendance={handleQuickMark}
      />

      <CreateDateTabModal
        isOpen={isCreateDateTabOpen}
        onClose={() => setIsCreateDateTabOpen(false)}
        existingTabs={availableTabs}
        currentActiveTab={activeTabName}
        onCreateTab={handleCreateDateTab}
        isCreating={isCreatingTab}
      />
    </div>
  );
}
