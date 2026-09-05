import React, { useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, X, CheckCircle, AlertCircle, Download, Trash2, RotateCcw, Clock } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import type { ExcelImportRecord } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExcelUploadModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // Management tab states
  const [excelImports, setExcelImports] = useState<ExcelImportRecord[]>([]);
  const [loadingImports, setLoadingImports] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingAll, setResettingAll] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchExcelImports();
    }
  }, [isOpen]);

  const fetchExcelImports = async () => {
    setLoadingImports(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/inventory/excel-imports`);
      setExcelImports(res.data);
    } catch (err: any) {
      console.error('Failed to fetch excel imports', err);
    } finally {
      setLoadingImports(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload-excel`, formData);
      setResult(res.data.result);
      fetchExcelImports();
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה בעת העלאת הקובץ');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImport = async (importId: string, filename: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את רשומת האקסל "${filename}"?\nכל הפריטים הנדרשים שיובאו מקובץ זה יימחקו וחישוב החריגות יתאפס בהתאם.`)) {
      return;
    }

    setDeletingId(importId);
    setActionMessage(null);
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/inventory/excel-imports/${importId}`);
      setActionMessage(res.data.message || 'רשומת האקסל והפריטים הנדרשים נמחקו בהצלחה');
      fetchExcelImports();
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה במחיקת רשומת האקסל');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetAllBaseline = async () => {
    if (!window.confirm('זהירות: פעולה זו תאפס ותמחק את כל הפריטים הרשמיים הנדרשים במערכת מכל קבצי האקסל!\nהאם להמשיך?')) {
      return;
    }

    setResettingAll(true);
    setActionMessage(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/inventory/baseline/reset`);
      setActionMessage(res.data.message || 'כל הפריטים הנדרשים אופסו בהצלחה');
      fetchExcelImports();
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה באיפוס המצאי הנדרש');
    } finally {
      setResettingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-base sm:text-lg text-white">ניהול מצאי רשמי (אקסל)</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 px-4 sm:px-6 bg-gray-950/40">
          <button
            onClick={() => { setActiveTab('upload'); setError(null); setActionMessage(null); }}
            className={`py-3 px-4 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>העלאת קובץ חדש</span>
          </button>
          <button
            onClick={() => { setActiveTab('manage'); setError(null); setActionMessage(null); fetchExcelImports(); }}
            className={`py-3 px-4 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>היסטוריית קבצים ואיפוס ({excelImports.length})</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {actionMessage && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'upload' ? (
            <>
              <p className="text-sm text-gray-400 leading-relaxed">
                העלה קובץ אקסל (.xlsx / .csv) לעדכון רשומות המצאי הרשמיות של הארגון. המערכת תשמור את שם הקובץ ותאפשר לאפס או להסיר את הרשומות הנדרשות בכל עת.
              </p>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>עמודות חובה:</strong> Catalog # (מסח"א), בעל מצאי.
                  <br />
                  <strong>עמודות אופציונליות:</strong> כמות (Quantity), תיאור, Serial Number (S/N), קטגוריה.
                </span>
              </div>

              <div className="border-2 border-dashed border-gray-700 hover:border-emerald-500/50 rounded-xl p-6 text-center transition-colors">
                <input
                  type="file"
                  id="excel-file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="excel-file" className="cursor-pointer flex flex-col items-center gap-2">
                  <UploadCloud className="w-10 h-10 text-emerald-400 animate-bounce" />
                  <span className="text-sm font-medium text-gray-200">
                    {file ? file.name : 'לחץ לבחירת קובץ או גרור לכאן'}
                  </span>
                  <span className="text-xs text-gray-500">תומך ב-XLSX, XLS או CSV</span>
                </label>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/40 px-4 py-2.5 rounded-lg border border-gray-800">
                <span>רוצה לראות פורמט לדוגמה?</span>
                <a
                  href={`${API_BASE_URL}/api/sample-excel`}
                  download
                  className="flex items-center gap-1 text-emerald-400 hover:underline font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  הורד קובץ תבנית
                </a>
              </div>

              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>הייבוא הסתיים: נוספו {result.insertedCount} פריטים, עודכנו {result.updatedCount}.</span>
                  </div>

                  {result.errors && result.errors.length > 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 space-y-1.5 max-h-32 overflow-y-auto text-xs text-rose-300">
                      <div className="font-semibold text-rose-400">שגיאות בשורות שלא נקלטו ({result.errors.length}):</div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {result.errors.map((errStr: string, idx: number) => (
                          <li key={idx}>{errStr}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">קבצי אקסל שיובאו למערכת</h4>
                  <p className="text-xs text-gray-400">הסרת קובץ תאפס את רשימת הפריטים הנדרשים שהגיעו ממנו</p>
                </div>
                {excelImports.length > 0 && (
                  <button
                    onClick={handleResetAllBaseline}
                    disabled={resettingAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${resettingAll ? 'animate-spin' : ''}`} />
                    <span>איפוס כל הנדרש</span>
                  </button>
                )}
              </div>

              {loadingImports ? (
                <div className="text-center py-8 text-gray-500 text-xs">טוען היסטוריית קבצים...</div>
              ) : excelImports.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs bg-gray-950/40 border border-gray-800 rounded-xl p-6">
                  <FileSpreadsheet className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p>לא נמצאו קבצי אקסל רשומים במערכת.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {excelImports.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-gray-950/60 border border-gray-800 hover:border-gray-700 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-semibold text-xs sm:text-sm text-white truncate" title={rec.filename}>
                            {rec.filename}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                          <span>תאריך: {new Date(rec.uploaded_at).toLocaleString('he-IL')}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-medium">
                            {rec.active_items_count} פריטים נדרשים פעילים
                          </span>
                          {rec.total_rows > 0 && (
                            <>
                              <span>•</span>
                              <span>({rec.total_rows} שורות בקובץ)</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteImport(rec.id, rec.filename)}
                        disabled={deletingId === rec.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/20 transition-all shrink-0"
                        title="מחק קובץ זה ואפס את הפריטים הנדרשים ממנו"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${deletingId === rec.id ? 'animate-spin' : ''}`} />
                        <span>מחק ואפס פריטים</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-950/50 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            סגור
          </button>
          {activeTab === 'upload' && (
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="px-5 py-2 text-sm font-medium rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-all shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'מייבא...' : 'ייבא נתונים'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};