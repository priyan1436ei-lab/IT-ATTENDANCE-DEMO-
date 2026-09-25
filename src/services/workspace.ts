// Google Workspace API Service for Forms, Sheets, and Drive
import { getAccessToken, setAccessToken, googleSignIn, logoutUser, auth } from './firebaseAuth';
import { AttendanceRecord, SheetRowData } from '../types/attendance';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: any) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

class WorkspaceService {
  public getStoredToken(): string | null {
    return getAccessToken();
  }

  public isAuthenticated(): boolean {
    return !!getAccessToken();
  }

  public async login(): Promise<string> {
    // 1. Primary auth method: Firebase Auth signInWithPopup (preserves standard Firebase session & handles popups robustly)
    try {
      const res = await googleSignIn();
      return res.accessToken;
    } catch (fbErr: any) {
      console.warn('Firebase signInWithPopup failed or was closed, attempting Google Identity Services fallback:', fbErr);
      
      // If user closed the popup intentionally or blocked popup, provide clear error
      if (fbErr?.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed. Please click Sign In again and complete the Google login dialog.');
      }
      if (fbErr?.code === 'auth/popup-blocked') {
        throw new Error('Browser blocked the sign-in popup. Please allow popups for this site and try again.');
      }

      // 2. Fallback to GIS client if available
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

    // Create empty form
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

    // Add attendance questions (Roll Number, Full Name, Status, Remarks)
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
      console.warn('Could not populate questions on form directly:', await updateRes.text());
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

    const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to fetch Form details');
    }

    return await res.json();
  }

  /**
   * 4. Fetch Form Responses
   */
  public async getFormResponses(formId: string): Promise<any[]> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to read form responses');
    }

    const data = await res.json();
    return data.responses || [];
  }

  /**
   * 5. Convert Raw Form Responses to Structured Attendance Records using Form question titles
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
        Object.entries(r.answers).forEach(([qId, ans]: [string, any]) => {
          const title = questionMap[qId] || '';
          const textVal = ans.textAnswers?.answers?.[0]?.value || '';

          if (title.includes('roll') || title.includes('register') || title.includes('reg') || title.includes('id')) {
            rollNumber = textVal.trim().toUpperCase();
          } else if (title.includes('name') || title.includes('student')) {
            studentName = textVal.trim();
          } else if (title.includes('status') || title.includes('attendance') || title.includes('present')) {
            const rawStatus = textVal.toLowerCase();
            if (rawStatus.includes('late')) status = 'Late';
            else if (rawStatus.includes('absent')) status = 'Absent';
            else if (rawStatus.includes('duty') || rawStatus.includes('excused') || rawStatus.includes('od')) status = 'Excused';
            else status = 'Present';
          } else if (title.includes('remark') || title.includes('reason') || title.includes('note')) {
            notes = textVal.trim();
          } else {
            // Fallback heuristics:
            if (!rollNumber && /^[0-9a-zA-Z]{5,15}$/.test(textVal)) {
              rollNumber = textVal.toUpperCase();
            } else if (!studentName && textVal.length > 2) {
              studentName = textVal;
            }
          }
        });
      }

      return {
        responseId: r.responseId,
        timestamp: r.createTime || new Date().toISOString(),
        studentName: studentName || r.respondentEmail || 'Unknown Student',
        rollNumber: rollNumber || 'N/A',
        email: r.respondentEmail || undefined,
        status,
        sessionName,
        notes,
        syncedToSheet: false
      };
    });
  }

  /**
   * 6. Read existing rows from Google Sheet to avoid duplicates
   */
  public async getSheetRecords(spreadsheetId: string, sheetName: string = 'Attendance Records'): Promise<SheetRowData[]> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const range = `${sheetName}!A2:G`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

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
   */
  public async appendRecordsToSheet(
    spreadsheetId: string,
    records: AttendanceRecord[],
    sheetName: string = 'Attendance Records'
  ): Promise<{ insertedCount: number }> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated');
    if (!records.length) return { insertedCount: 0 };

    // Check existing records by reading the sheet
    const existing = await this.getSheetRecords(spreadsheetId, sheetName);
    const existingKeys = new Set(
      existing.map((r) => `${r.rollNumber?.toLowerCase()}_${r.session?.toLowerCase()}`)
    );

    // Filter out duplicates (same roll number and session)
    const newRecords = records.filter(
      (r) => !existingKeys.has(`${r.rollNumber?.toLowerCase()}_${r.sessionName?.toLowerCase()}`)
    );

    if (newRecords.length === 0) {
      return { insertedCount: 0 };
    }

    const rows = newRecords.map((r) => [
      new Date(r.timestamp).toLocaleString(),
      r.rollNumber,
      r.studentName,
      r.status,
      r.sessionName || 'General',
      r.notes || '',
      r.responseId || ''
    ]);

    const range = `${sheetName}!A:G`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rows
        })
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to sync to Google Sheet');
    }

    return { insertedCount: newRecords.length };
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
    const total = presentCount + absentCount + lateCount;
    const percentage = total > 0 ? `${Math.round(((presentCount + lateCount) / total) * 100)}%` : '0%';

    const row = [dateStr, sessionName, presentCount, absentCount, lateCount, percentage];

    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Daily%20Summary!A:F:append?valueInputOption=USER_ENTERED`,
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
      console.error('Failed to update daily summary:', e);
    }
  }
}

export const workspaceService = new WorkspaceService();
