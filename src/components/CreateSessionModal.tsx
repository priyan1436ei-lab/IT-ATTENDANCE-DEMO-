import React, { useState } from 'react';
import { Sparkles, FileText, Table, Check, ExternalLink, Calendar, BookOpen, Layers } from 'lucide-react';
import { workspaceService } from '../services/workspace';
import { AttendanceSession } from '../types/attendance';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (session: AttendanceSession) => void;
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const [subject, setSubject] = useState('');
  const [department, setDepartment] = useState('B.Tech / B.E - IT');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sessionTitle, setSessionTitle] = useState('');
  const [step, setStep] = useState<'details' | 'creating' | 'done'>('details');
  const [progressMsg, setProgressMsg] = useState('');
  const [createdSession, setCreatedSession] = useState<AttendanceSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) return;

    setStep('creating');
    setError(null);

    const title = sessionTitle.trim() || `${subject} - Attendance`;

    try {
      // Step 1: Create Google Form
      setProgressMsg('1/3 Creating Google Form with Roll No & Status questions...');
      const form = await workspaceService.createAttendanceForm(title, subject, date);

      // Step 2: Create Google Sheet Register
      setProgressMsg('2/3 Setting up Google Spreadsheet register & summary tabs...');
      const sheetTitle = `${subject} Attendance Register (${date})`;
      const sheet = await workspaceService.createAttendanceSpreadsheet(sheetTitle);

      // Step 3: Bundle into attendance session
      setProgressMsg('3/3 Linking Form and Sheet real-time sync...');
      const newSession: AttendanceSession = {
        id: 'sess_' + Date.now(),
        title,
        subject,
        department,
        date,
        formId: form.formId,
        formResponderUri: form.responderUri,
        formEditUri: form.editUri,
        spreadsheetId: sheet.id,
        spreadsheetUrl: sheet.spreadsheetUrl,
        sheetName: 'Attendance Records',
        totalEnrolled: 60,
        createdAt: new Date().toISOString()
      };

      setCreatedSession(newSession);
      onCreated(newSession);
      setStep('done');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to setup Google Form and Sheet');
      setStep('details');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h2 className="text-xl font-bold">New Class Attendance Session</h2>
          </div>
          <p className="text-emerald-100 text-xs">
            Creates a dedicated Google Form for students & a Google Sheet attendance register synced in real-time.
          </p>
        </div>

        {step === 'details' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 text-xs bg-rose-50 text-rose-700 rounded-lg border border-rose-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject / Course Name *
              </label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures & Algorithms, Python Lab"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department / Class
                </label>
                <div className="relative">
                  <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. IT - 3rd Year"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Session Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Session Title (Optional)
              </label>
              <input
                type="text"
                placeholder={subject ? `${subject} - Period 1 (${date})` : 'Auto-generated title'}
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Form & Sheet</span>
              </button>
            </div>
          </form>
        )}

        {step === 'creating' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">Generating Workspace Resources...</h3>
              <p className="text-xs text-slate-500 font-mono">{progressMsg}</p>
            </div>
          </div>
        )}

        {step === 'done' && createdSession && (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Attendance Session Ready!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your Google Form and Google Sheet register are created and linked.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Google Form (Student Attendance Link)
                </span>
                <a
                  href={createdSession.formResponderUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-600 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  Open Form <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-emerald-600" />
                  Google Sheet (Official Attendance Register)
                </span>
                <a
                  href={createdSession.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  Open Sheet <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                Go to Attendance Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
