// Local storage manager for attendance sessions, auto-sync timers, student roster, and role authentication
import { AttendanceSession, StudentProfile, AppUserSession } from '../types/attendance';

const SESSIONS_KEY = 'attendance_app_sessions_v1';
const ROSTER_KEY = 'attendance_app_roster_v1';
const CURRENT_USER_KEY = 'attendance_app_current_user_v1';
const ADMIN_CREDENTIALS_KEY = 'attendance_app_admin_cred_v1';

export const storage = {
  // Current logged in user (Admin or Student)
  getCurrentUser(): AppUserSession | null {
    try {
      const data = localStorage.getItem(CURRENT_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: AppUserSession | null): void {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  },

  getAdminCredentials(): { username: string; passwordHash: string } {
    try {
      const data = localStorage.getItem(ADMIN_CREDENTIALS_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // default
    }
    // Default admin login credentials: admin / admin123
    return { username: 'admin', passwordHash: 'admin123' };
  },

  setAdminCredentials(username: string, passwordHash: string): void {
    localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify({ username, passwordHash }));
  },

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
    // Default sample class roster with default passwords (default: 123456 or rollNumber)
    return [
      { rollNumber: '22IT001', name: 'Aakash Sharma', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT002', name: 'Abhinav Ram', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT003', name: 'Ananya Sundar', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT004', name: 'Bhavani Shankar', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT005', name: 'Deepak Kumar', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT006', name: 'Divya Dharshini', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT007', name: 'Hari Prasad', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT008', name: 'Kavitha Murugan', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT009', name: 'Madhavan R', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT010', name: 'Praveen Raj', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT011', name: 'Priya Dharshini', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT012', name: 'Rahul Krishnan', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT013', name: 'Sanjay Kumar', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT014', name: 'Sneha Venkatesh', department: 'Information Technology', password: '123' },
      { rollNumber: '22IT015', name: 'Vigneshwaran P', department: 'Information Technology', password: '123' }
    ];
  },

  saveRoster(roster: StudentProfile[]): void {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  }
};
