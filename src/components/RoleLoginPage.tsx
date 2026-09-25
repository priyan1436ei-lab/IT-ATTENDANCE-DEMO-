import React, { useState } from 'react';
import { Shield, GraduationCap, ArrowRight, Lock, User, AlertCircle, KeyRound } from 'lucide-react';
import { storage } from '../services/storage';
import { AppUserSession } from '../types/attendance';

interface RoleLoginPageProps {
  onLoginSuccess: (user: AppUserSession) => void;
}

export const RoleLoginPage: React.FC<RoleLoginPageProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');

  // Student login form
  const [studentRoll, setStudentRoll] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  // Admin login form
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');

  const [error, setError] = useState<string | null>(null);

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const roll = studentRoll.trim().toUpperCase();
    if (!roll) {
      setError('Please enter your Roll Number / Register Number.');
      return;
    }

    const roster = storage.getRoster();
    const student = roster.find((s) => s.rollNumber.toUpperCase() === roll);

    if (!student) {
      setError(`Roll Number "${roll}" is not registered in the class roster. Please contact your instructor or admin.`);
      return;
    }

    // Check password if set (default: 123)
    if (student.password && studentPassword && student.password !== studentPassword && studentPassword !== '123') {
      setError('Incorrect password. Please enter the valid password (Default: 123).');
      return;
    }

    const session: AppUserSession = {
      role: 'student',
      identifier: student.rollNumber,
      name: student.name,
      department: student.department || 'Information Technology'
    };

    storage.setCurrentUser(session);
    onLoginSuccess(session);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const adminCreds = storage.getAdminCredentials();

    if (adminUsername.trim() !== adminCreds.username || adminPassword !== adminCreds.passwordHash) {
      setError('Invalid admin username or password! (Default credentials: admin / admin123)');
      return;
    }

    const session: AppUserSession = {
      role: 'admin',
      identifier: adminCreds.username,
      name: 'Class Attendance Admin',
      department: 'Department Staff'
    };

    storage.setCurrentUser(session);
    onLoginSuccess(session);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Brand Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 p-6 text-white text-center">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            {activeTab === 'student' ? (
              <GraduationCap className="w-8 h-8 text-emerald-300" />
            ) : (
              <Shield className="w-8 h-8 text-amber-300" />
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight">Class Attendance Portal</h1>
          <p className="text-xs text-emerald-100 mt-1">
            Google Forms & Google Sheets Real-Time Sync
          </p>

          {/* Role Tabs */}
          <div className="flex bg-black/20 p-1 rounded-xl mt-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('student');
                setError(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'student'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Student Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setError(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin Login</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'student' ? (
            /* Student Login Form */
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Roll Number / Register Number *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. 22IT001"
                    value={studentRoll}
                    onChange={(e) => setStudentRoll(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm uppercase font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your unique student roll number from the class roster.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password (Default: 123)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>Sign In as Student</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-800">
                💡 <strong>Notice for Students:</strong> After logging in, you can directly access the Google Form link to mark today's attendance and verify your real-time status recorded in Google Sheets.
              </div>
            </form>
          ) : (
            /* Admin Login Form */
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Username *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="admin"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Password *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="Enter admin password (admin123)"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Default credentials: <code>admin</code> / <code>admin123</code>
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>Sign In as Admin</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                🛡️ <strong>Admin Controls:</strong> Add/manage students in roster, link Google Form & Google Sheet, initiate live auto-sync, and manage attendance registers.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
