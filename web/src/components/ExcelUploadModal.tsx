import React, { useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle, Download, Trash2, RotateCcw, Clock } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import type { ExcelImportRecord } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Button,
} from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onDataChanged?: () => void;
}

export const ExcelUploadModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, onDataChanged }) => {
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
  const [typeFilter, setTypeFilter] = useState<'all' | 'signatures' | 'scans'>('all');

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
      if (onDataChanged) {
        onDataChanged();
      }
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה בעת העלאת הקובץ');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImport = async (rec: ExcelImportRecord) => {
    const isScan = rec.import_type === 'scans';
    const typeLabel = isScan ? 'סריקות' : 'חתימות';
    const countLabel = isScan ? 'תצפיות סריקה' : 'פריטי חתימה רשמיים';

    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את קובץ ה${typeLabel} "${rec.filename}"?\nכל ${rec.active_items_count} ה${countLabel} שיובאו מקובץ זה יימחקו והמערכת תתעדכן בהתאם.`)) {
      return;
    }

    setDeletingId(rec.id);
    setActionMessage(null);
    setError(null);
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/inventory/excel-imports/${rec.id}`);
      setActionMessage(res.data.message || `קובץ ה${typeLabel} והנתונים שהגיעו ממנו נמחקו בהצלחה`);
      fetchExcelImports();
      if (onDataChanged) {
        onDataChanged();
      }
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
    setError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/inventory/baseline/reset`);
      setActionMessage(res.data.message || 'כל הפריטים הנדרשים אופסו בהצלחה');
      fetchExcelImports();
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה באיפוס המצאי הנדרש');
    } finally {
      setResettingAll(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" className="p-0">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <DialogTitle className="font-semibold text-base sm:text-lg text-white">ניהול מצאי רשמי (אקסל)</DialogTitle>
          </div>
        </DialogHeader>

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

        <DialogBody className="p-4 sm:p-6 space-y-4">
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
                העלה קובץ אקסל (.xlsx / .csv) של <strong>חתימות בעלי המצאי</strong> בארגון (דוח מנוהלים / טופס 1004). המערכת שומרת את החתימות כבסיס להשוואה מול הסריקות הפיזיות בחדרים.
              </p>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <div>
                    <strong>פורמטים נתמכים:</strong> טבלת חתימות רגילה (עמודות: מסח"א / מק"ט, בעל מצאי, כמות) או <strong>מטריצת תיק אחוד</strong> (עמודות כמו: <code>כמות בתיק [שם]</code>).
                  </div>
                  <div>
                    <strong>זיהוי גליונות חכם:</strong> המערכת מזהה אוטומטית את גליון החתימות ("תיק אחוד") וגליונות תיק אישיים גם בקבצים מרובי גליונות.
                  </div>
                  <div className="text-[11px] text-emerald-200/80 pt-0.5">
                    💡 <strong>שים לב:</strong> אין צורך במספרים סידוריים (S/N) באקסל. פריטים ללא S/N נרשמים כמכסת חתימות רשמית, וה-S/N המקורי ייקלט ישירות בסריקות הפיזיות בשטח.
                  </div>
                </div>
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

              <div className="flex items-center justify-between text-xs text-blue-300 bg-blue-500/10 px-4 py-2.5 rounded-lg border border-blue-500/20">
                <span>רוצה לייבא סריקות היסטוריות של חדרים מ-Google Forms?</span>
                <span className="text-blue-400 font-semibold">עבור לעמוד "סריקות" ולחץ על "ייבוא סריקות מאקסל"</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-white">קבצי אקסל ונתונים שיובאו</h4>
                  <p className="text-xs text-gray-400">מחיקת קובץ תסיר את כל החתימות או הסריקות שהגיעו ממנו</p>
                </div>
                {excelImports.some(i => i.import_type !== 'scans') && (
                  <button
                    onClick={handleResetAllBaseline}
                    disabled={resettingAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all self-start sm:self-auto"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${resettingAll ? 'animate-spin' : ''}`} />
                    <span>איפוס כל החתימות</span>
                  </button>
                )}
              </div>

              {/* Type Filter Pills */}
              {excelImports.length > 0 && (
                <div className="flex items-center gap-1.5 p-1 bg-gray-950/60 rounded-xl border border-gray-800 text-xs w-fit">
                  <button
                    type="button"
                    onClick={() => setTypeFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-all ${typeFilter === 'all' ? 'bg-emerald-500 text-white font-bold shadow-xs' : 'text-gray-400 hover:text-white'}`}
                  >
                    הכל ({excelImports.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter('signatures')}
                    className={`px-3 py-1 rounded-lg transition-all ${typeFilter === 'signatures' ? 'bg-emerald-500 text-white font-bold shadow-xs' : 'text-gray-400 hover:text-white'}`}
                  >
                    חתימות מצאי ({excelImports.filter(i => (i.import_type || 'signatures') === 'signatures').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter('scans')}
                    className={`px-3 py-1 rounded-lg transition-all ${typeFilter === 'scans' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-gray-400 hover:text-white'}`}
                  >
                    סריקות שטח ({excelImports.filter(i => i.import_type === 'scans').length})
                  </button>
                </div>
              )}

              {loadingImports ? (
                <div className="text-center py-8 text-gray-500 text-xs">טוען היסטוריית קבצים...</div>
              ) : excelImports.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs bg-gray-950/40 border border-gray-800 rounded-xl p-6">
                  <FileSpreadsheet className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p>לא נמצאו קבצי אקסל רשומים במערכת.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {excelImports
                    .filter(rec => typeFilter === 'all' || (rec.import_type || 'signatures') === typeFilter)
                    .map((rec) => {
                      const isScan = rec.import_type === 'scans';
                      return (
                        <div
                          key={rec.id}
                          className="bg-gray-950/60 border border-gray-800 hover:border-gray-700 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <FileSpreadsheet className={`w-4 h-4 ${isScan ? 'text-blue-400' : 'text-emerald-400'} shrink-0`} />
                              <span className="font-semibold text-xs sm:text-sm text-white truncate max-w-xs" title={rec.filename}>
                                {rec.filename}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                isScan 
                                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              }`}>
                                {isScan ? 'סריקות שטח' : 'חתימות רשמיות'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                              <span>תאריך: {new Date(rec.uploaded_at).toLocaleString('he-IL')}</span>
                              <span>•</span>
                              <span className={`${isScan ? 'text-blue-300' : 'text-emerald-400'} font-medium`}>
                                {rec.active_items_count} {isScan ? 'סריקות פעילות' : 'חתימות פעילות'}
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
                            onClick={() => handleDeleteImport(rec)}
                            disabled={deletingId === rec.id}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/20 transition-all shrink-0 cursor-pointer self-end sm:self-auto"
                            title={isScan ? 'מחק קובץ זה ובטל את כל הסריקות שנוצרו ממנו' : 'מחק קובץ זה ובטל את כל החתימות שנוצרו ממנו'}
                          >
                            <Trash2 className={`w-3.5 h-3.5 ${deletingId === rec.id ? 'animate-spin' : ''}`} />
                            <span>מחק קובץ ונתונים</span>
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </DialogBody>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-950/50">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            סגור
          </Button>
          {activeTab === 'upload' && (
            <Button
              type="button"
              variant="default"
              onClick={handleUpload}
              disabled={!file || loading}
              loading={loading}
            >
              {loading ? 'מייבא...' : 'ייבא נתונים'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};