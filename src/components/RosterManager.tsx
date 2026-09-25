import React, { useState } from 'react';
import { Users, Plus, Trash2, Edit2, Upload, FileText, Check } from 'lucide-react';
import { StudentProfile } from '../types/attendance';

interface RosterManagerProps {
  roster: StudentProfile[];
  onUpdateRoster: (roster: StudentProfile[]) => void;
}

export const RosterManager: React.FC<RosterManagerProps> = ({ roster, onUpdateRoster }) => {
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Information Technology');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoll || !newName) return;
    const exists = roster.some((s) => s.rollNumber.toLowerCase() === newRoll.toLowerCase().trim());
    if (exists) {
      alert('Student with this Roll Number already exists in the roster!');
      return;
    }
    const updated = [...roster, { rollNumber: newRoll.toUpperCase().trim(), name: newName.trim(), department: newDept }];
    onUpdateRoster(updated);
    setNewRoll('');
    setNewName('');
  };

  const handleDelete = (roll: string) => {
    const updated = roster.filter((s) => s.rollNumber !== roll);
    onUpdateRoster(updated);
  };

  const handleBulkImport = () => {
    const lines = bulkText.split('\n');
    const newStudents: StudentProfile[] = [];
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        newStudents.push({
          rollNumber: parts[0].toUpperCase(),
          name: parts[1],
          department: parts[2] || 'IT'
        });
      }
    }
    if (newStudents.length > 0) {
      // Merge unique
      const existingRolls = new Set(roster.map((r) => r.rollNumber.toUpperCase()));
      const filtered = newStudents.filter((s) => !existingRolls.has(s.rollNumber));
      onUpdateRoster([...roster, ...filtered]);
      setBulkText('');
      setShowBulk(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Class Student Roster ({roster.length} Students)
          </h3>
          <p className="text-xs text-slate-500">
            Enrolled class students. Used for attendance verification and absentee tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Bulk CSV / Paste</span>
          </button>
        </div>
      </div>

      {showBulk && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 animate-in fade-in">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Paste Roll Number and Name (One per line, comma or tab separated):
          </label>
          <textarea
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="22IT016, Rajesh Kumar, Information Technology&#10;22IT017, Meera Krishnan, Information Technology"
            className="w-full text-xs font-mono p-2 border border-slate-200 rounded-lg bg-white mb-2"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBulk(false)}
              className="text-xs text-slate-600 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkImport}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg transition"
            >
              Import Students
            </button>
          </div>
        </div>
      )}

      {/* Add Single Student Form */}
      <form onSubmit={handleAddSingle} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
        <input
          type="text"
          placeholder="Roll No (e.g. 22IT016)"
          value={newRoll}
          onChange={(e) => setNewRoll(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
        />
        <input
          type="text"
          placeholder="Student Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none sm:col-span-2"
        />
        <button
          type="submit"
          className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Student</span>
        </button>
      </form>

      {/* Roster Grid */}
      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
        {roster.map((s, idx) => (
          <div key={s.rollNumber} className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-mono text-[11px] w-5 text-right">{idx + 1}.</span>
              <span className="font-mono font-semibold text-slate-800">{s.rollNumber}</span>
              <span className="text-slate-700 font-medium">{s.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline">{s.department || 'IT'}</span>
              <button
                onClick={() => handleDelete(s.rollNumber)}
                className="text-slate-400 hover:text-rose-600 p-1 transition"
                title="Remove student"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
