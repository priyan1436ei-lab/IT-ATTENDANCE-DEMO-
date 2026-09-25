// Google Workspace API Service for Forms, Sheets, and Drive
import { getAccessToken, setAccessToken, googleSignIn, logoutUser, auth } from './firebaseAuth';
import { AttendanceRecord, SheetRowData } from '../types/attendance';

export interface SyncDiagnosis {
  formId: string;
  spreadsheetId: string;
  totalFormResponses: number;
  totalSheetRows: number;
  newRowsAdded: number;
  alreadyInSheetCount: number;
  errors: string[];
}

class WorkspaceService {
  public getStoredToken(): string | null {
    return getAccessToken();
  }

  public isAuthenticated(): boolean {
    return !!getAccessToken();
  }

  public async login(): Promise<string> {
    try {
      const res = await googleSignIn();
      return res.accessToken;
    } catch (fbErr: any) {
      console.warn('Firebase signInWithPopup failed or was closed, attempting fallback:', fbErr);
      if (fbErr?.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed. Please click Sign In again and complete the Google login dialog.');
      }
      if (fbErr?.code === 'auth/popup-blocked') {
        throw new Error('Browser blocked the sign-in popup. Please allow popups for this site and try again.');
      }

      // Fallback to GIS client if available
      return new Promise<string>((resolve, reject) => {
        if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
          try {
            const client = window.google.accounts.oauth2.initTokenClient({
              client_id: '164560374471-5hvhfroai1582m1h92n77ucd2h1kkhb4.apps.googleusercontent.com',
              scope: [
                'https://www.googleapis.com/auth/forms.body',
                'https://www.googleapis.com/auth/forms.responses.readonly',
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
              ].join(' '),
              callback: (tokenRes: any) => {
                if (tokenRes.error) {
                  reject(new Error(tokenRes.error_description || tokenRes.error || 'GIS OAuth Error'));
                  return;
                }
                setAccessToken(tokenRes.access_token);
                resolve(tokenRes.access_token);
              },
              error_callback: (err: any) => {
                const message = err?.message || (typeof err === 'string' ? err : 'Google popup was closed or cancelled.');
                reject(new Error(message));
              }
            });
            client.requestAccessToken({ prompt: 'select_account' });
            return;
          } catch (gisErr) {
            reject(gisErr);
            return;
          }
        }
        reject(fbErr);
      });
    }
  }

  public async logout(): Promise<void> {
    await logoutUser();
  }

  public async getUserProfile(): Promise<{ name: string; email: string; picture?: string } | null> {
    const token = getAccessToken();
    const currentUser = auth.currentUser;

    if (currentUser?.displayName && currentUser?.email) {
      return {
        name: currentUser.displayName,
        email: currentUser.email,
        picture: currentUser.photoURL || undefined
      };
    }

    if (!token) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Helper to extract Form ID or Spreadsheet ID from any user-pasted URL or raw ID
   */
  public extractIdFromUrl(input: string): string {
    if (!input) return '';
    const clean = input.trim();
    // Google Forms URL: /forms/d/e/.../viewform or /forms/d/<formId>/edit
    const formMatch = clean.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
    if (formMatch && formMatch[1]) return formMatch[1];

    // Google Sheets URL: /spreadsheets/d/<sheetId>/
    const sheetMatch = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetMatch && sheetMatch[1]) return sheetMatch[1];

    // Otherwise assume it's the raw ID
    return clean;
  }

  /**
   * 1. Create a Google Spreadsheet with pre-formatted Attendance columns and styles
   */
  public async createAttendanceSpreadsheet(title: string): Promise<{ id: string; spreadsheetUrl: string }> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated with Google. Please sign in first.');

    const body = {
      properties: {
        title: title || `Class Attendance Register - ${new Date().toLocaleDateString()}`
      },
      sheets: [
        {
          properties: {
            title: 'Attendance Records',
            gridProperties: {
              frozenRowCount: 1
            }
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Timestamp' } },
                    { userEnteredValue: { stringValue: 'Roll Number' } },
                    { userEnteredValue: { stringValue: 'Student Name' } },
                    { userEnteredValue: { stringValue: 'Status' } },
                    { userEnteredValue: { stringValue: 'Session / Class' } },
                    { userEnteredValue: { stringValue: 'Notes / Remarks' } },
                    { userEnteredValue: { stringValue: 'Form Response ID' } }
                  ]
                }
              ]
            }
          ]
        },
        {
          properties: {
            title: 'Daily Summary',
            gridProperties: {
              frozenRowCount: 1
            }
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Date' } },
                    { userEnteredValue: { stringValue: 'Class / Subject' } },
                    { userEnteredValue: { stringValue: 'Total Present' } },
                    { userEnteredValue: { stringValue: 'Total Absent' } },
                    { userEnteredValue: { stringValue: 'Total Late' } },
                    { userEnteredValue: { stringValue: 'Attendance %' } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to create Google Spreadsheet');
    }

    const data = await res.json();
    return {
      id: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl
    };
  }

  /**
   * 2. Create a Google Form tailored for Attendance taking
   */
  public async createAttendanceForm(title: string, subjectName: string, dateStr: string): Promise<{ formId: string; responderUri: string; editUri: string }> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated with Google. Please sign in first.');

    // Step 1: Create initial Form
    const initRes = await fetch('https://forms.googleapis.com/v1/forms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        info: {
          title: title || `${subjectName} - Attendance (${dateStr})`,
          documentTitle: `${subjectName} Attendance ${dateStr}`
        }
      })
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to create Google Form');
    }

    const formData = await initRes.json();
    const formId = formData.formId;

    // Step 2: Add attendance questions (Roll Number, Full Name, Status, Remarks)
    const updatePayload = {
      requests: [
        {
          updateFormInfo: {
            info: {
              description: `Please mark your attendance for ${subjectName} on ${dateStr}. Responses are synced automatically to the official class attendance register.`
            },
            updateMask: 'description'
          }
        },
        {
          createItem: {
            item: {
              title: 'Roll Number / Register Number',
              description: 'Enter your unique college/school roll number (e.g. 21IT001)',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: {
                    paragraph: false
                  }
                }
              }
            },
            location: {
              index: 0
            }
          }
        },
        {
          createItem: {
            item: {
              title: 'Student Full Name',
              description: 'Enter your full name as per class records',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: {
                    paragraph: false
                  }
                }
              }
            },
            location: {
              index: 1
            }
          }
        },
        {
          createItem: {
            item: {
              title: 'Attendance Status',
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: {
                    type: 'RADIO',
                    options: [
                      { value: 'Present' },
                      { value: 'Late' },
                      { value: 'Excused / On Duty (OD)' }
                    ]
                  }
                }
              }
            },
            location: {
              index: 2
            }
          }
        },
        {
          createItem: {
            item: {
              title: 'Additional Remarks / Reasons (Optional)',
              questionItem: {
                question: {
                  required: false,
                  textQuestion: {
                    paragraph: true
                  }
                }
              }
            },
            location: {
              index: 3
            }
          }
        }
      ]
    };

    const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateRes.ok) {
      console.warn('Form batchUpdate warning:', await updateRes.text());
    }

    return {
      formId: formData.formId,
      responderUri: formData.responderUri,
      editUri: `https://docs.google.com/forms/d/${formData.formId}/edit`
    };
  }

  /**
   * 3. Fetch Form details and question questionId mapping
   */
  public async getFormDetails(formId: string): Promise<any> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const cleanId = this.extractIdFromUrl(formId);
    const res = await fetch(`https://forms.googleapis.com/v1/forms/${cleanId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch Form details (ID: ${cleanId})`);
    }

    return await res.json();
  }

  /**
   * 4. Fetch Form Responses
   */
  public async getFormResponses(formId: string): Promise<any[]> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const cleanId = this.extractIdFromUrl(formId);
    const res = await fetch(`https://forms.googleapis.com/v1/forms/${cleanId}/responses`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to read Form responses (ID: ${cleanId})`);
    }

    const data = await res.json();
    return data.responses || [];
  }

  /**
   * 5. Convert Raw Form Responses to Structured Attendance Records using Form question titles
   * Robust against any Form structure (Tamil/English questions, varying formats)
   */
  public parseResponses(formDetails: any, responses: any[], sessionName: string): AttendanceRecord[] {
    const questionMap: { [questionId: string]: string } = {};

    if (formDetails?.items) {
      for (const item of formDetails.items) {
        if (item.questionItem?.question?.questionId) {
          questionMap[item.questionItem.question.questionId] = item.title?.toLowerCase() || '';
        }
      }
    }

    return responses.map((r: any) => {
      let rollNumber = '';
      let studentName = '';
      let status: 'Present' | 'Absent' | 'Late' | 'Excused' = 'Present';
      let notes = '';

      if (r.answers) {
        // Collect all answered text values
        const answeredPairs: { title: string; val: string }[] = [];

        Object.entries(r.answers).forEach(([qId, ans]: [string, any]) => {
          const title = (questionMap[qId] || '').toLowerCase();
          const textVal = ans.textAnswers?.answers?.[0]?.value?.trim() || '';
          if (textVal) {
            answeredPairs.push({ title, val: textVal });
          }
        });

        // 1. Identify by Question Title Keywords
        for (const { title, val } of answeredPairs) {
          if (
            title.includes('roll') ||
            title.includes('register') ||
            title.includes('reg') ||
            title.includes('id') ||
            title.includes('எண்') ||
            title.includes('பதிவு')
          ) {
            rollNumber = val.toUpperCase();
          } else if (
            title.includes('name') ||
            title.includes('student') ||
            title.includes('பெயர்')
          ) {
            studentName = val;
          } else if (
            title.includes('status') ||
            title.includes('attendance') ||
            title.includes('வருகை') ||
            title.includes('present')
          ) {
            const rawStatus = val.toLowerCase();
            if (rawStatus.includes('late') || rawStatus.includes('தாமதம்')) status = 'Late';
            else if (rawStatus.includes('absent') || rawStatus.includes('இல்லை')) status = 'Absent';
            else if (rawStatus.includes('duty') || rawStatus.includes('excused') || rawStatus.includes('od')) status = 'Excused';
            else status = 'Present';
          } else if (
            title.includes('remark') ||
            title.includes('reason') ||
            title.includes('note') ||
            title.includes('குறிப்பு')
          ) {
            notes = val;
          }
        }

        // 2. Fallbacks if titles didn't match (generic forms)
        for (const { val } of answeredPairs) {
          if (!rollNumber && /^[0-9a-zA-Z_-]{4,15}$/.test(val) && !val.includes(' ')) {
            rollNumber = val.toUpperCase();
          } else if (!studentName && val.length >= 2 && !val.includes('@') && val !== rollNumber) {
            // Check if looks like a name
            const sLower = val.toLowerCase();
            if (!['present', 'absent', 'late', 'od', 'excused'].includes(sLower)) {
              studentName = val;
            }
          }
        }
      }

      // If still missing name, check respondentEmail
      if (!studentName && r.respondentEmail) {
        studentName = r.respondentEmail.split('@')[0];
      }
      if (!studentName) {
        studentName = 'Student ' + (rollNumber || r.responseId?.slice(-4) || '—');
      }

      return {
        responseId: r.responseId,
        timestamp: r.createTime || new Date().toISOString(),
        studentName: studentName || 'Unknown Student',
        rollNumber: rollNumber || 'N/A',
        email: r.respondentEmail || undefined,
        status,
        sessionName: sessionName || 'General Session',
        notes,
        syncedToSheet: false
      };
    });
  }

  /**
   * 6. Read existing rows from Google Sheet
   * Dynamically checks first sheet name if "Attendance Records" doesn't exist
   */
  public async getSheetRecords(spreadsheetId: string, sheetName: string = 'Attendance Records'): Promise<SheetRowData[]> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const cleanId = this.extractIdFromUrl(spreadsheetId);

    // Try reading target sheet name
    let range = `${sheetName}!A2:G`;
    let res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    // If target sheetName failed, inspect spreadsheet to find the real sheet tab title
    if (!res.ok) {
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets.properties.title`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const firstSheet = meta.sheets?.[0]?.properties?.title || 'Sheet1';
        range = `${firstSheet}!A2:G`;
        res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
      }
    }

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const rows = data.values || [];

    return rows.map((row: any[], index: number) => ({
      rowNumber: index + 2,
      timestamp: row[0] || '',
      rollNumber: row[1] || '',
      name: row[2] || '',
      status: row[3] || 'Present',
      session: row[4] || '',
      notes: row[5] || ''
    }));
  }

  /**
   * 7. Append Attendance records to Google Sheet
   * Uses Response ID or (Roll Number + Timestamp) for precise deduplication
   */
  public async appendRecordsToSheet(
    spreadsheetId: string,
    records: AttendanceRecord[],
    sheetName: string = 'Attendance Records'
  ): Promise<{ insertedCount: number; alreadyExistingCount: number; totalProcessed: number }> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');
    if (!records.length) return { insertedCount: 0, alreadyExistingCount: 0, totalProcessed: 0 };

    const cleanId = this.extractIdFromUrl(spreadsheetId);

    // Check existing records by reading the sheet
    const existing = await this.getSheetRecords(cleanId, sheetName);

    // Build deduplication sets:
    // 1. By Response ID (exact form submission id stored in column G)
    // 2. By RollNumber + Session (only if roll number is valid, not N/A)
    const existingResponseIds = new Set<string>();
    const existingRollSession = new Set<string>();

    existing.forEach((r) => {
      if (r.notes && r.notes.startsWith('resp_')) {
        existingResponseIds.add(r.notes);
      }
      if (r.rollNumber && r.rollNumber !== 'N/A') {
        existingRollSession.add(`${r.rollNumber.trim().toUpperCase()}_${r.session.trim().toLowerCase()}`);
      }
    });

    // Also read raw range A:G to inspect Column G (response ID)
    try {
      const fullRangeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(sheetName + '!G2:G')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (fullRangeRes.ok) {
        const gData = await fullRangeRes.json();
        (gData.values || []).forEach((row: string[]) => {
          if (row[0]) existingResponseIds.add(row[0].trim());
        });
      }
    } catch {
      // ignore
    }

    const newRecords = records.filter((r) => {
      // 1. If responseId already recorded
      if (r.responseId && existingResponseIds.has(r.responseId.trim())) {
        return false;
      }
      // 2. If valid roll number and already exists in this session
      if (r.rollNumber && r.rollNumber !== 'N/A') {
        const key = `${r.rollNumber.trim().toUpperCase()}_${(r.sessionName || '').trim().toLowerCase()}`;
        if (existingRollSession.has(key)) {
          return false;
        }
      }
      return true;
    });

    if (newRecords.length === 0) {
      return {
        insertedCount: 0,
        alreadyExistingCount: records.length,
        totalProcessed: records.length
      };
    }

    // Format new rows
    const rows = newRecords.map((r) => [
      new Date(r.timestamp).toLocaleString(),
      r.rollNumber,
      r.studentName,
      r.status,
      r.sessionName || 'General',
      r.notes || '',
      r.responseId || ''
    ]);

    // Ensure header row exists if sheet is empty
    if (existing.length === 0) {
      const checkHeaderRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(sheetName + '!A1:G1')}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const hData = await checkHeaderRes.json();
      if (!hData.values || hData.values.length === 0) {
        // Write header
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(sheetName + '!A1:G1')}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              values: [['Timestamp', 'Roll Number', 'Student Name', 'Status', 'Session / Class', 'Notes / Remarks', 'Form Response ID']]
            })
          }
        );
      }
    }

    // Append rows
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(sheetName + '!A:G')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: rows
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to append rows to Google Sheet');
    }

    return {
      insertedCount: newRecords.length,
      alreadyExistingCount: records.length - newRecords.length,
      totalProcessed: records.length
    };
  }

  /**
   * 8. Mark / Update manual attendance directly into Sheet
   */
  public async addManualRecordToSheet(
    spreadsheetId: string,
    record: AttendanceRecord,
    sheetName: string = 'Attendance Records'
  ): Promise<void> {
    await this.appendRecordsToSheet(spreadsheetId, [record], sheetName);
  }

  /**
   * 9. Update daily summary in Sheet
   */
  public async updateDailySummary(
    spreadsheetId: string,
    dateStr: string,
    sessionName: string,
    presentCount: number,
    absentCount: number,
    lateCount: number
  ): Promise<void> {
    const token = getAccessToken();
    if (!token) return;
    const cleanId = this.extractIdFromUrl(spreadsheetId);
    const total = presentCount + absentCount + lateCount;
    const percentage = total > 0 ? `${Math.round(((presentCount + lateCount) / total) * 100)}%` : '0%';

    const row = [dateStr, sessionName, presentCount, absentCount, lateCount, percentage];

    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/Daily%20Summary!A:F:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [row]
          })
        }
      );
    } catch (e) {
      console.warn('Failed to update daily summary:', e);
    }
  }

  /**
   * Diagnose Form and Sheet Connection
   */
  public async diagnoseSync(formId: string, spreadsheetId: string): Promise<SyncDiagnosis> {
    const cleanFormId = this.extractIdFromUrl(formId);
    const cleanSheetId = this.extractIdFromUrl(spreadsheetId);
    const errors: string[] = [];

    let totalFormResponses = 0;
    let totalSheetRows = 0;

    try {
      const responses = await this.getFormResponses(cleanFormId);
      totalFormResponses = responses.length;
    } catch (e: any) {
      errors.push(`Form error: ${e.message}`);
    }

    try {
      const sheetRows = await this.getSheetRecords(cleanSheetId);
      totalSheetRows = sheetRows.length;
    } catch (e: any) {
      errors.push(`Sheet error: ${e.message}`);
    }

    return {
      formId: cleanFormId,
      spreadsheetId: cleanSheetId,
      totalFormResponses,
      totalSheetRows,
      newRowsAdded: 0,
      alreadyInSheetCount: 0,
      errors
    };
  }
}

export const workspaceService = new WorkspaceService();
