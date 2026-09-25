export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface AttendanceRecord {
  responseId: string;
  timestamp: string; // ISO string
  studentName: string;
  rollNumber: string;
  email?: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  sessionName?: string;
  notes?: string;
  syncedToSheet?: boolean;
}

export interface AttendanceSession {
  id: string;
  title: string;
  subject: string;
  department: string;
  date: string; // YYYY-MM-DD
  formId?: string;
  formResponderUri?: string;
  formEditUri?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheetName?: string;
  totalEnrolled?: number;
  createdAt: string;
  lastSyncAt?: string;
}

export interface StudentProfile {
  rollNumber: string;
  name: string;
  email?: string;
  department?: string;
}

export interface SheetRowData {
  rowNumber: number;
  timestamp: string;
  rollNumber: string;
  name: string;
  status: string;
  session: string;
  notes: string;
}
