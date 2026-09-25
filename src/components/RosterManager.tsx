import React, { useState } from 'react';
import { Users, Plus, Trash2, Upload, UserPlus, Check, Shield } from 'lucide-react';
import { StudentProfile } from '../types/attendance';

interface RosterManagerProps {
  roster: StudentProfile[];
  onUpdateRoster: (roster: StudentProfile[]) => void;
  isAdmin: boolean;
}

export const RosterManager: React.FC<RosterManagerProps> = ({ roster, onUpdateRoster, isAdmin }) => {
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Information Technology');
  const [newPassword, setNewPassword] = useState('123');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only administrators have permission to add new students.');
      return;
    }

    const roll = newRoll.toUpperCase().trim();
    const name = newName.trim();

    if (!roll || !name) return;

    const exists = roster.some((s) => s.rollNumber.toUpperCase() === roll);
    if (exists) {
      alert(`Student with Roll Number "${roll}" is already in the roster!`);
      return;
    }

    const newStudent: StudentProfile = {
      rollNumber: roll,
      name,
      department: newDept.trim(),
      password: newPassword.trim() || '123'
    };

    const updated = [newStudent, ...roster];
    onUpdateRoster(updated);

    setNotification(`New student added: ${roll} - ${name} (Login Password: ${newStudent.password})`);
    setTimeout(() => setNotification(null), 4000);

    setNewRoll('');
    setNewName('');
    setNewPassword('123');
  };

  const handleDelete = (roll: string) => {
    if (!isAdmin) {
      alert('Only administrators can remove students.');
      return;
    }
    const updated = roster.filter((s) => s.rollNumber !== roll);
    onUpdateRoster(updated);
  };

  const handleBulkImport = () => {
    if (!isAdmin) return;
    const lines = bulkText.split('\n');
    const newStudents: StudentProfile[] = [];

    for (const line of lines) {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        newStudents.push({
          rollNumber: parts[0].toUpperCase(),
          name: parts[1],
          department: parts[2] || 'Information Technology',
          password: parts[3] || '123'
        });
      }
    }

    if (newStudents.length > 0) {
      const existingRolls = new Set(roster.map((r) => r.rollNumber.toUpperCase()));
      const filtered = newStudents.filter((s) => !existingRolls.has(s.rollNumber));
      onUpdateRoster([...roster, ...filtered]);
      setBulkText('');
      setShowBulk(false);
      setNotification(`${filtered.length} students imported successfully.`);
      setTimeout(() => setNotification(null), 4000);
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
            Enrolled class students. Each student can sign in using their unique Roll Number.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition cursor-pointer flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Bulk CSV Import</span>
            </button>
          </div>
        )}
      </div>

      {notification && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Admin Feature: Add New Student Form */}
      {isAdmin ? (
        <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-slate-800">
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span>Add New Student to Class Roster</span>
          </div>
          <form onSubmit={handleAddSingle} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input
              type="text"
              required
              placeholder="Roll No (e.g. 22IT016)"
              value={newRoll}
              onChange={(e) => setNewRoll(e.target.value)}
              className="text-xs uppercase font-mono border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <input
              type="text"
              required
              placeholder="Student Full Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-emerald-500 outline-none sm:col-span-2"
            />
            <input
              type="text"
              placeholder="Login Password (Default: 123)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <button
              type="submit"
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          <span>Only administrators can add or remove students from the roster (View only mode).</span>
        </div>
      )}

      {showBulk && isAdmin && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 animate-in fade-in">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Paste one student per line (Roll No, Name, Department, Password):
          </label>
          <textarea
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="22IT016, Rajesh Kumar, Information Technology, 123&#10;22IT017, Meera Krishnan, Information Technology, 123"
            className="w-full text-xs font-mono p-2 border border-slate-200 rounded-lg bg-white mb-2"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBulk(false)}
              className="text-xs text-slate-600 px-3 py-1.5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkImport}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg transition cursor-pointer"
            >
              Import Students
            </button>
          </div>
        </div>
      )}

      {/* Roster Grid */}
      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
        {roster.map((s, idx) => (
          <div key={s.rollNumber} className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-mono text-[11px] w-6 text-right">{idx + 1}.</span>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                {s.rollNumber}
              </span>
              <span className="text-slate-800 font-semibold">{s.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 hidden sm:inline">{s.department || 'IT'}</span>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                    PWD: {s.password || '123'}
                  </span>
                  <button
                    onClick={() => handleDelete(s.rollNumber)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                    title="Remove student"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
