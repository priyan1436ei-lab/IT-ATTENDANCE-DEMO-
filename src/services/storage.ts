// Local storage manager for attendance sessions, auto-sync timers, and student roster
import { AttendanceSession, StudentProfile } from '../types/attendance';

const SESSIONS_KEY = 'attendance_app_sessions_v1';
const ROSTER_KEY = 'attendance_app_roster_v1';
const AUTOSYNC_KEY = 'attendance_app_autosync_interval';

export const storage = {
  getSessions(): AttendanceSession[] {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveSessions(sessions: AttendanceSession[]): void {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  },

  addSession(session: AttendanceSession): void {
    const sessions = this.getSessions();
    const updated = [session, ...sessions.filter((s) => s.id !== session.id)];
    this.saveSessions(updated);
  },

  updateSession(session: AttendanceSession): void {
    const sessions = this.getSessions();
    const updated = sessions.map((s) => (s.id === session.id ? session : s));
    this.saveSessions(updated);
  },

  deleteSession(sessionId: string): void {
    const sessions = this.getSessions().filter((s) => s.id !== sessionId);
    this.saveSessions(sessions);
  },

  getRoster(): StudentProfile[] {
    try {
      const data = localStorage.getItem(ROSTER_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    // Default sample class roster
    return [
      { rollNumber: '22IT001', name: 'Aakash Sharma', department: 'Information Technology' },
      { rollNumber: '22IT002', name: 'Abhinav Ram', department: 'Information Technology' },
      { rollNumber: '22IT003', name: 'Ananya Sundar', department: 'Information Technology' },
      { rollNumber: '22IT004', name: 'Bhavani Shankar', department: 'Information Technology' },
      { rollNumber: '22IT005', name: 'Deepak Kumar', department: 'Information Technology' },
      { rollNumber: '22IT006', name: 'Divya Dharshini', department: 'Information Technology' },
      { rollNumber: '22IT007', name: 'Hari Prasad', department: 'Information Technology' },
      { rollNumber: '22IT008', name: 'Kavitha Murugan', department: 'Information Technology' },
      { rollNumber: '22IT009', name: 'Madhavan R', department: 'Information Technology' },
      { rollNumber: '22IT010', name: 'Praveen Raj', department: 'Information Technology' },
      { rollNumber: '22IT011', name: 'Priya Dharshini', department: 'Information Technology' },
      { rollNumber: '22IT012', name: 'Rahul Krishnan', department: 'Information Technology' },
      { rollNumber: '22IT013', name: 'Sanjay Kumar', department: 'Information Technology' },
      { rollNumber: '22IT014', name: 'Sneha Venkatesh', department: 'Information Technology' },
      { rollNumber: '22IT015', name: 'Vigneshwaran P', department: 'Information Technology' }
    ];
  },

  saveRoster(roster: StudentProfile[]): void {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  },

  getAutoSyncInterval(): number {
    return parseInt(localStorage.getItem(AUTOSYNC_KEY) || '30', 10); // default 30 seconds
  },

  setAutoSyncInterval(seconds: number): void {
    localStorage.setItem(AUTOSYNC_KEY, seconds.toString());
  }
};
