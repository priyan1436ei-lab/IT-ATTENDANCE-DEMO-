import React from 'react';
import { LogIn, LogOut, CheckCircle2, ShieldCheck, User } from 'lucide-react';

interface AuthBarProps {
  isAuthenticated: boolean;
  userInfo: { name: string; email: string; picture?: string } | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoading: boolean;
}

export const AuthBar: React.FC<AuthBarProps> = ({
  isAuthenticated,
  userInfo,
  onLogin,
  onLogout,
  isLoading
}) => {
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm font-bold text-lg">
            ✓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Class Attendance Sync
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                Forms ➔ Sheets
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Google Form attendance auto-synced into Google Sheet register
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-full py-1.5 px-3">
                {userInfo?.picture ? (
                  <img
                    src={userInfo.picture}
                    alt={userInfo.name}
                    className="w-6 h-6 rounded-full border border-slate-300"
                  />
                ) : (
                  <User className="w-4 h-4 text-slate-500" />
                )}
                <div className="text-left text-xs">
                  <p className="font-semibold text-slate-800 leading-none truncate max-w-[120px] sm:max-w-[160px]">
                    {userInfo?.name || 'Authorized User'}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[120px] sm:max-w-[160px] leading-tight">
                    {userInfo?.email || 'Connected'}
                  </p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-1" />
              </div>

              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition cursor-pointer"
                title="Disconnect Google Account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={onLogin}
                disabled={isLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm px-4 py-2 rounded-lg shadow-sm transition hover:shadow cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>{isLoading ? 'Connecting...' : 'Connect Google Workspace'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
