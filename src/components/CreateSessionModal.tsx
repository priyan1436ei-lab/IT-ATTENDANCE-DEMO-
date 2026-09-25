import React, { useState } from 'react';
import { Table, Check, ExternalLink, Calendar, BookOpen, Layers, Link2, FileText } from 'lucide-react';
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

  // Existing links
  const [existingFormUrl, setExistingFormUrl] = useState('');
  const [existingSheetUrl, setExistingSheetUrl] = useState('');

  const [step, setStep] = useState<'details' | 'connecting' | 'done'>('details');
  const [progressMsg, setProgressMsg] = useState('');
  const [createdSession, setCreatedSession] = useState<AttendanceSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) return;

    const formId = workspaceService.extractIdFromUrl(existingFormUrl);
    const sheetId = workspaceService.extractIdFromUrl(existingSheetUrl);

    if (!formId) {
      setError('Please enter a valid Google Form URL or Form ID.');
      return;
    }

    if (!sheetId) {
      setError('Please enter a valid Google Sheet URL or Sheet ID.');
      return;
    }

    setStep('connecting');
    setError(null);

    const title = sessionTitle.trim() || `${subject} - Attendance`;

    try {
      setProgressMsg('1/2 Verifying Google Form permissions and questions...');
      await workspaceService.getFormDetails(formId);

      setProgressMsg('2/2 Verifying Google Sheet register tabs...');
      await workspaceService.getSheetRecords(sheetId);

      const linkedSession: AttendanceSession = {
        id: 'sess_' + Date.now(),
        title,
        subject,
        department,
        date,
        formId,
        formResponderUri: existingFormUrl.includes('viewform')
          ? existingFormUrl
          : `https://docs.google.com/forms/d/${formId}/viewform`,
        formEditUri: `https://docs.google.com/forms/d/${formId}/edit`,
        spreadsheetId: sheetId,
        spreadsheetUrl: existingSheetUrl.startsWith('http')
          ? existingSheetUrl
          : `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        sheetName: 'Attendance Records',
        totalEnrolled: 60,
        createdAt: new Date().toISOString()
      };

      setCreatedSession(linkedSession);
      onCreated(linkedSession);
      setStep('done');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not connect Google Form or Google Sheet. Please verify the URLs and access permissions.');
      setStep('details');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-5 h-5 text-emerald-300" />
            <h2 className="text-xl font-bold">Connect Google Form & Google Sheet</h2>
          </div>
          <p className="text-emerald-100 text-xs">
            Link your existing Google Form and Google Sheet spreadsheet to establish automatic real-time sync.
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
                Course / Subject Name *
              </label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures, Python Lab, Operating Systems"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Class / Department
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

            {/* Links Section */}
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  Your Google Form URL or Form ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://docs.google.com/forms/d/..."
                  value={existingFormUrl}
                  onChange={(e) => setExistingFormUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The Google Form where students submit their attendance.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  Your Google Sheet URL or Sheet ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={existingSheetUrl}
                  onChange={(e) => setExistingSheetUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The destination Google Sheet where student records will be added.
                </p>
              </div>
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
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect & Link</span>
              </button>
            </div>
          </form>
        )}

        {step === 'connecting' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">Connecting Form & Sheet...</h3>
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
              <h3 className="text-base font-bold text-slate-900">Form & Sheet Linked Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your Google Form and Google Sheet are connected. New responses will sync directly into the spreadsheet.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Google Form
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
                  Google Sheet
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
