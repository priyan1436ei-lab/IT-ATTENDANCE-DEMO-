import React, { useState } from 'react';
import { UserCheck, AlertCircle, Plus, Check } from 'lucide-react';
import { StudentProfile } from '../types/attendance';

interface QuickMarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: StudentProfile[];
  onMarkAttendance: (student: { rollNumber: string; name: string; status: 'Present' | 'Absent' | 'Late' | 'Excused'; notes: string }) => Promise<void>;
}

export const QuickMarkModal: React.FC<QuickMarkModalProps> = ({
  isOpen,
  onClose,
  roster,
  onMarkAttendance
}) => {
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [customRoll, setCustomRoll] = useState('');
  const [customName, setCustomName] = useState('');
  const [status, setStatus] = useState<'Present' | 'Absent' | 'Late' | 'Excused'>('Present');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const roll = selectedStudent ? selectedStudent.rollNumber : customRoll.trim();
    const name = selectedStudent ? selectedStudent.name : customName.trim();

    if (!roll || !name) return;

    setIsSubmitting(true);
    setSuccessMsg('');
    try {
      await onMarkAttendance({
        rollNumber: roll,
        name,
        status,
        notes
      });
      setSuccessMsg(`Marked ${roll} (${name}) as ${status} in Google Sheet!`);
      // Reset
      setNotes('');
      setTimeout(() => {
        setSuccessMsg('');
      }, 2500);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-100">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Quick Manual Attendance Mark</h3>
              <p className="text-xs text-slate-500">Directly append or adjust student status in Google Sheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {successMsg && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Student from Class Roster
            </label>
            <select
              value={selectedStudent ? selectedStudent.rollNumber : 'CUSTOM'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'CUSTOM') {
                  setSelectedStudent(null);
                } else {
                  const s = roster.find((r) => r.rollNumber === val);
                  if (s) setSelectedStudent(s);
                }
              }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="CUSTOM">+ Enter Custom Student Roll / Name</option>
              {roster.map((s) => (
                <option key={s.rollNumber} value={s.rollNumber}>
                  {s.rollNumber} - {s.name} ({s.department})
                </option>
              ))}
            </select>
          </div>

          {!selectedStudent && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Roll Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 22IT016"
                  value={customRoll}
                  onChange={(e) => setCustomRoll(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Student name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Attendance Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['Present', 'Late', 'Excused', 'Absent'] as const).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`py-2 px-1 text-xs font-medium rounded-lg border transition cursor-pointer text-center ${
                    status === st
                      ? st === 'Present'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : st === 'Late'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : st === 'Excused'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {st === 'Excused' ? 'On Duty' : st}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Remarks / Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Medical leave, Sports competition, Late by 10 mins"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving to Sheet...' : 'Add to Google Sheet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
