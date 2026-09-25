import React, { useState } from 'react';
import { Table, Search, Download, CheckCircle, Clock, AlertTriangle, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { SheetRowData } from '../types/attendance';

interface SheetTableViewProps {
  records: SheetRowData[];
  spreadsheetUrl?: string;
  isLoading: boolean;
  onRefresh: () => void;
}

export const SheetTableView: React.FC<SheetTableViewProps> = ({
  records,
  spreadsheetUrl,
  isLoading,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filtered = records.filter((r) => {
    const matchesSearch =
      r.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.notes.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'ALL') return matchesSearch;
    return matchesSearch && r.status.toLowerCase().includes(filterStatus.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('present')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle className="w-3 h-3 text-emerald-600" />
          Present
        </span>
      );
    }
    if (s.includes('late')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Late
        </span>
      );
    }
    if (s.includes('excused') || s.includes('duty') || s.includes('od')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          On Duty
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
        <AlertTriangle className="w-3 h-3 text-rose-600" />
        {status || 'Absent'}
      </span>
    );
  };

  const exportCSV = () => {
    if (!records.length) return;
    const header = ['Row', 'Timestamp', 'Roll Number', 'Student Name', 'Status', 'Session', 'Notes'];
    const rows = records.map((r) => [
      r.rowNumber,
      `"${r.timestamp}"`,
      `"${r.rollNumber}"`,
      `"${r.name}"`,
      `"${r.status}"`,
      `"${r.session}"`,
      `"${r.notes}"`
    ]);

    const csvContent = [header.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Sheet_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Header Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Live Google Sheet Register
            </h3>
            <p className="text-xs text-slate-500">
              Direct live mirror of responses inserted into Google Sheets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search name, roll no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="Present">Present Only</option>
            <option value="Late">Late Only</option>
            <option value="Excused">On Duty / OD</option>
            <option value="Absent">Absent Only</option>
          </select>

          {/* Refresh Sheet */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 text-slate-600 hover:text-emerald-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
            title="Refresh from Google Sheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1 text-xs text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition disabled:opacity-40 cursor-pointer"
            title="Download CSV Backup"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4 w-12 text-center">Row</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Roll No</th>
              <th className="py-3 px-4">Student Name</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Session / Class</th>
              <th className="py-3 px-4">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  {records.length === 0
                    ? 'No attendance entries in Google Sheet yet. Share the Form or click "Sync Form ➔ Sheet".'
                    : 'No matching entries found.'}
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                    {row.rowNumber}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                    {row.timestamp}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900 font-mono">
                    {row.rollNumber}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    {row.name}
                  </td>
                  <td className="py-2.5 px-4">
                    {getStatusBadge(row.status)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 max-w-[150px] truncate">
                    {row.session}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 max-w-[200px] truncate">
                    {row.notes || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{' '}
          <span className="font-semibold text-slate-700">{records.length}</span> recorded attendance rows
        </div>

        {spreadsheetUrl && (
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 hover:text-emerald-800 font-medium hover:underline inline-flex items-center gap-1"
          >
            <span>View Full Spreadsheet in Google Sheets</span>
            <span>➔</span>
          </a>
        )}
      </div>
    </div>
  );
};
