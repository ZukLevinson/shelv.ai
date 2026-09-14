import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Search,
  Check,
  Info,
  MapPin,
  Tag,
  Trash2
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import type { ExcelImportRecord } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  Button,
} from './ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUserName?: string;
}

export interface ParsedScanRow {
  rowIdx: number;
  timestamp: string; // ISO string
  rawTimestamp: string;
  rawRoom: string;
  roomId: string | null;
  roomCode: string | null;
  roomName: string | null;
  masha: string;
  rawSerialNumber: string;
  serialNumber: string | null;
  isIrrelevantSN: boolean;
  snNote: string | null;
  isDuplicate: boolean;
  duplicateOfRow?: number;
  duplicateReason?: string;
  hasError: boolean;
  errorMessage?: string;
  willImport: boolean;
}

export interface ParseExcelScansResult {
  filename: string;
  sheetName: string;
  totalRows: number;
  validRowsCount: number;
  duplicatesCount: number;
  emptySnCount: number;
  errorsCount: number;
  errors: string[];
  duplicates: Array<{
    rowIdx: number;
    masha: string;
    serialNumber: string | null;
    duplicateOfRow: number;
    reason: string;
  }>;
  irrelevantSnRows: Array<{
    rowIdx: number;
    originalText: string;
  }>;
  rows: ParsedScanRow[];
}

export const ScanExcelUploadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUserName = 'ייבוא היסטורי Google Forms'
}) => {
  const { token, user } = useAuth();
  const effectiveToken = token || (typeof window !== 'undefined' ? localStorage.getItem('shelv_token') : null);

  const [mainTab, setMainTab] = useState<'upload' | 'history'>('upload');
  const [scanImports, setScanImports] = useState<ExcelImportRecord[]>([]);
  const [loadingScanImports, setLoadingScanImports] = useState(false);
  const [deletingScanImportId, setDeletingScanImportId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseExcelScansResult | null>(null);

  // Preview filtering states
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'duplicates' | 'errors'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedBy, setScannedBy] = useState(user?.name || currentUserName);
  const [insertedCount, setInsertedCount] = useState(0);

  const fetchScanImports = async () => {
    setLoadingScanImports(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/inventory/excel-imports?type=scans`);
      setScanImports(res.data);
    } catch (err: any) {
      console.error('Failed to fetch scan imports', err);
    } finally {
      setLoadingScanImports(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScanImports();
    }
  }, [isOpen]);

  const handleDeleteScanImport = async (rec: ExcelImportRecord) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את קובץ הסריקות "${rec.filename}"?\nכל ${rec.active_items_count} תצפיות הסריקה שהגיעו מקובץ זה יימחקו מהמערכת והחריגות יתעדכנו בהתאם.`)) {
      return;
    }

    setDeletingScanImportId(rec.id);
    setActionMessage(null);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (effectiveToken) headers['Authorization'] = `Bearer ${effectiveToken}`;

      const res = await axios.delete(`${API_BASE_URL}/api/inventory/excel-imports/${rec.id}`, { headers });
      setActionMessage(res.data.message || 'קובץ הסריקות והתצפיות שנוצרו ממנו נמחקו בהצלחה');
      fetchScanImports();
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה במחיקת קובץ הסריקות');
    } finally {
      setDeletingScanImportId(null);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setError(null);
    setActionMessage(null);
    setParseResult(null);
    setStatusFilter('all');
    setSearchTerm('');
    setInsertedCount(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleParseFile = async () => {
    if (!file) {
      setError('נא לבחור קובץ אקסל או PDF להעלאה');
      return;
    }

    setAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/sweep/scans/parse-excel`, formData, {
        headers
      });
      setParseResult(res.data);
      setStep('preview');
    } catch (err: any) {
      console.error('Failed to parse scans file:', err);
      setError(err.response?.data?.error || 'שגיאה בפענוח קובץ הסריקות (אקסל או PDF)');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!parseResult) return;
    const rowsToImport = parseResult.rows.filter(r => r.willImport);
    if (rowsToImport.length === 0) {
      setError('אין שורות תקינות לייבוא');
      return;
    }

    setSaving(true);
    setError(null);

    const headers: Record<string, string> = {};
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/sweep/scans/import-excel`,
        {
          rows: rowsToImport,
          scannedBy: scannedBy.trim() || user?.name || currentUserName,
          originalFilename: parseResult.filename
        },
        {
          headers
        }
      );

      setInsertedCount(res.data.insertedCount || rowsToImport.length);
      setStep('success');
      onSuccess();
    } catch (err: any) {
      console.error('Failed to import scans:', err);
      setError(err.response?.data?.error || 'שגיאה בעת שמירת הסריקות במערכת');
    } finally {
      setSaving(false);
    }
  };

  // Filter rows for the united preview table
  const filteredRows = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.filter((r) => {
      // Status filter
      if (statusFilter === 'valid' && !r.willImport) return false;
      if (statusFilter === 'duplicates' && !r.isDuplicate) return false;
      if (statusFilter === 'errors' && !r.hasError) return false;

      // Text search
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchesMasha = r.masha.toLowerCase().includes(q);
        const matchesSN = (r.serialNumber || '').toLowerCase().includes(q);
        const matchesRawSN = (r.rawSerialNumber || '').toLowerCase().includes(q);
        const matchesRoom = (r.roomName || '').toLowerCase().includes(q) ||
          (r.roomCode || '').toLowerCase().includes(q) ||
          r.rawRoom.toLowerCase().includes(q);
        const matchesNote = (r.snNote || '').toLowerCase().includes(q);
        if (!matchesMasha && !matchesSN && !matchesRawSN && !matchesRoom && !matchesNote) {
          return false;
        }
      }

      return true;
    });
  }, [parseResult, statusFilter, searchTerm]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="5xl" className="p-0">
        {/* Modal Header */}
        <DialogHeader className="px-4 sm:px-6 py-3.5 border-b border-gray-800 bg-gray-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-bold text-base sm:text-lg text-white">
                ייבוא סריקות מאקסל או PDF (Google Forms / Drive)
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-gray-400">
                טעינת סריקות היסטוריות מקובץ אקסל ("Form Responses 1") או יצוא PDF מ-Google Drive בנייד, זיהוי חדרים וסינון כפילויות
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 px-4 sm:px-6 bg-gray-950/40">
          <button
            onClick={() => { setMainTab('upload'); setError(null); setActionMessage(null); }}
            className={`py-3 px-4 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              mainTab === 'upload'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>העלאת קובץ סריקות חדש</span>
          </button>
          <button
            onClick={() => { setMainTab('history'); setError(null); setActionMessage(null); fetchScanImports(); }}
            className={`py-3 px-4 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
              mainTab === 'history'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>היסטוריית קבצי סריקות ({scanImports.length})</span>
          </button>
        </div>

        {/* Global Action Banner */}
        {actionMessage && (
          <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <DialogBody className="p-4 sm:p-6 space-y-4">
          {mainTab === 'history' ? (
            <div className="space-y-4 max-w-3xl mx-auto py-2">
              <div>
                <h4 className="text-sm font-semibold text-white">קבצי סריקות שיובאו למערכת</h4>
                <p className="text-xs text-gray-400">מחיקת קובץ סריקות תמחק את כל תצפיות הסריקה שהגיעו ממנו ותעדכן את החריגות</p>
              </div>

              {loadingScanImports ? (
                <div className="text-center py-10 text-gray-500 text-xs">טוען היסטוריית קבצי סריקות...</div>
              ) : scanImports.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs bg-gray-950/40 border border-gray-800 rounded-xl p-6">
                  <FileSpreadsheet className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p>לא נמצאו קבצי סריקות שיובאו למערכת.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {scanImports.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-gray-950/60 border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileSpreadsheet className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="font-semibold text-xs sm:text-sm text-white truncate max-w-md" title={rec.filename}>
                            {rec.filename}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-blue-500/10 text-blue-300 border-blue-500/20">
                            סריקות שטח
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                          <span>תאריך העלאה: {new Date(rec.uploaded_at).toLocaleString('he-IL')}</span>
                          <span>•</span>
                          <span className="text-blue-300 font-medium">
                            {rec.active_items_count} תצפיות סריקה שמורות
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
                        onClick={() => handleDeleteScanImport(rec)}
                        disabled={deletingScanImportId === rec.id}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/20 transition-all shrink-0 cursor-pointer self-end sm:self-auto"
                        title="מחק קובץ סריקות זה ובטל את כל הסריקות שנקלטו ממנו"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${deletingScanImportId === rec.id ? 'animate-spin' : ''}`} />
                        <span>מחק קובץ וסריקות</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {step === 'upload' && (
                <div className="space-y-4 max-w-2xl mx-auto py-2">
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                באפשרותך להעלות קובץ אקסל שמקורו ב-<strong>Google Forms</strong> או קובץ <strong>PDF</strong> שיוצא מ-<strong>Google Drive בנייד</strong>, המכיל תגובות של סריקות שבוצעו לפני הקמת המערכת.
                המערכת סורקת את הנתונים ומבצעת התאמות חכמות:
              </p>

              {/* Instructions Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-3 space-y-1 text-xs">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>זיהוי חדרים מתוך טקסט</span>
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    גם אם שדה החדר כולל טקסט נוסף (כגון "101 - חדר דיונים"), המערכת מזהה ומחלצת את מזהה וקוד החדר המדויק באפליקציה.
                  </p>
                </div>

                <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-3 space-y-1 text-xs">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>המרת הערות עבריות ל-S/N ריק</span>
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    הערות תיאוריות (כמו "המסך האמצעי של ישי" או "מתחת למדבקה") מומרות למספר סיריאלי ריק וההערה המקורית נשמרת.
                  </p>
                </div>

                <div className="bg-gray-950/70 border border-gray-800 rounded-xl p-3 space-y-1 text-xs sm:col-span-2">
                  <div className="font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>התרעה וסינון כפילויות לפני שמירה</span>
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    כל הכפילויות של מסח"א ומספר סיריאלי זהה מוצגות בטבלה המאוחדת ומסוננות אוטומטית כדי למנוע כפילויות במצאי.
                  </p>
                </div>
              </div>

              {/* File Dropzone */}
              <div className="border-2 border-dashed border-gray-700 hover:border-emerald-500/50 rounded-2xl p-6 sm:p-8 text-center transition-colors bg-gray-950/40">
                <input
                  type="file"
                  id="scan-excel-file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="scan-excel-file" className="cursor-pointer flex flex-col items-center gap-3">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                    <UploadCloud className="w-8 h-8 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-gray-200 block">
                      {file ? file.name : 'לחץ לבחירת קובץ אקסל/PDF או גרור לכאן'}
                    </span>
                    <span className="text-xs text-gray-500 block">
                      תומך בקבצי Excel (XLSX, XLS, CSV) וקבצי PDF שיוצאו מ-Google Drive בנייד
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 'preview' && parseResult && (
            <div className="space-y-4">
              
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
                  <div className="text-[11px] text-gray-400">סך שורות בקובץ</div>
                  <div className="text-lg sm:text-xl font-bold text-white mt-0.5">{parseResult.totalRows}</div>
                  <div className="text-[10px] text-gray-500 truncate" title={parseResult.sheetName}>
                    גליון: {parseResult.sheetName}
                  </div>
                </div>

                <div className="bg-gray-950 border border-emerald-900/30 rounded-xl p-3">
                  <div className="text-[11px] text-emerald-400">תקינות לייבוא</div>
                  <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-0.5">{parseResult.validRowsCount}</div>
                  <div className="text-[10px] text-emerald-500">מוכנות לשמירה</div>
                </div>

                <div className="bg-gray-950 border border-amber-900/30 rounded-xl p-3">
                  <div className="text-[11px] text-amber-400">כפילויות שסוננו</div>
                  <div className="text-lg sm:text-xl font-bold text-amber-400 mt-0.5">{parseResult.duplicatesCount}</div>
                  <div className="text-[10px] text-amber-500">לא יישמרו פעמיים</div>
                </div>

                <div className="bg-gray-950 border border-blue-900/30 rounded-xl p-3">
                  <div className="text-[11px] text-blue-400">הערות שהומרו ל-S/N ריק</div>
                  <div className="text-lg sm:text-xl font-bold text-blue-400 mt-0.5">{parseResult.irrelevantSnRows.length}</div>
                  <div className="text-[10px] text-blue-500">הערה נשמרה בתיעוד</div>
                </div>

                <div className="bg-gray-950 border border-rose-900/30 rounded-xl p-3 col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-rose-400">שגיאות (חסר חדר/מסח"א)</div>
                  <div className="text-lg sm:text-xl font-bold text-rose-400 mt-0.5">{parseResult.errorsCount}</div>
                  <div className="text-[10px] text-rose-500">לא ייקלטו</div>
                </div>
              </div>

              {/* Alerts & Warnings Panel */}
              <div className="space-y-2">
                {/* Duplications Alert */}
                {parseResult.duplicatesCount > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 sm:p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>אותרו {parseResult.duplicatesCount} כפילויות בקובץ (יסוננו אוטומטית)</span>
                    </div>
                    <p className="text-amber-200/80 text-[11px] leading-relaxed">
                      אותרו שורות המכילות את אותו המסח"א ומספר סיריאלי זהה (או סריקה כפולה מטופס Google Forms). המערכת תסנן אותן ותשמור רק מופע יחיד:
                    </p>
                    <div className="max-h-24 overflow-y-auto space-y-1 bg-gray-950/60 p-2 rounded-lg border border-amber-500/20 font-mono text-[11px]">
                      {parseResult.duplicates.map((d, idx) => (
                        <div key={idx} className="text-amber-300">
                          • שורה {d.rowIdx}: {d.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Irrelevant S/N Notification */}
                {parseResult.irrelevantSnRows.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-3 space-y-1.5 text-xs text-blue-300">
                    <div className="flex items-center gap-2 font-bold text-blue-400">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>זוהו {parseResult.irrelevantSnRows.length} שורות עם הערות בעברית בשדה S/N (כגון "המסך האמצעי של ישי")</span>
                    </div>
                    <p className="text-blue-200/80 text-[11px] leading-relaxed">
                      הערות אלו הומרו למספר סיריאלי ריק (NULL) והטקסט המקורי נשמר כהערת שטח בפריט.
                    </p>
                  </div>
                )}

                {/* Errors Alert */}
                {parseResult.errorsCount > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 sm:p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>נמצאו {parseResult.errorsCount} שגיאות בשורות שלא ניתן לייבא</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1 bg-gray-950/60 p-2 rounded-lg border border-rose-500/20 text-[11px]">
                      {parseResult.errors.map((errStr, idx) => (
                        <div key={idx} className="text-rose-300">• {errStr}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Toolbar: Search, Filters, and ScannedBy Operator */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-950/60 p-3 rounded-xl border border-gray-800">
                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      statusFilter === 'all'
                        ? 'bg-gray-800 text-white font-bold'
                        : 'text-gray-400 hover:text-white hover:bg-gray-900'
                    }`}
                  >
                    הכל ({parseResult.totalRows})
                  </button>
                  <button
                    onClick={() => setStatusFilter('valid')}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1 ${
                      statusFilter === 'valid'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                        : 'text-gray-400 hover:text-emerald-400 hover:bg-gray-900'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    <span>תקינים ({parseResult.validRowsCount})</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('duplicates')}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1 ${
                      statusFilter === 'duplicates'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                        : 'text-gray-400 hover:text-amber-400 hover:bg-gray-900'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>כפילויות ({parseResult.duplicatesCount})</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('errors')}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1 ${
                      statusFilter === 'errors'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                        : 'text-gray-400 hover:text-rose-400 hover:bg-gray-900'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    <span>שגיאות ({parseResult.errorsCount})</span>
                  </button>
                </div>

                {/* Search & Operator input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="חיפוש בטבלה..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-44 bg-gray-900 border border-gray-700 rounded-lg pr-8 pl-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-gray-400 shrink-0">מי סרק:</label>
                    <input
                      type="text"
                      value={scannedBy}
                      onChange={(e) => setScannedBy(e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 w-full sm:w-44"
                      placeholder="שם מבצע הייבוא"
                    />
                  </div>
                </div>
              </div>

              {/* United Table */}
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950">
                <div className="max-h-80 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-gray-900/90 text-gray-400 text-[11px] sticky top-0 z-10 border-b border-gray-800 select-none">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">שורה</th>
                        <th className="py-2.5 px-3 font-semibold">זמן סריקה</th>
                        <th className="py-2.5 px-3 font-semibold">חדר (מזוהה / מקור)</th>
                        <th className="py-2.5 px-3 font-semibold">מסח"א</th>
                        <th className="py-2.5 px-3 font-semibold">מספר סיריאלי (S/N)</th>
                        <th className="py-2.5 px-3 font-semibold">סטטוס</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 font-sans">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500">
                            לא נמצאו שורות התואמות את הסינון
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((r) => (
                          <tr
                            key={r.rowIdx}
                            className={`transition-colors ${
                              r.isDuplicate
                                ? 'bg-amber-950/20 hover:bg-amber-950/30'
                                : r.hasError
                                ? 'bg-rose-950/20 hover:bg-rose-950/30'
                                : 'hover:bg-gray-900/60'
                            }`}
                          >
                            <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">{r.rowIdx}</td>
                            
                            <td className="py-2 px-3 text-gray-300 font-mono text-[11px] whitespace-nowrap">
                              {new Date(r.timestamp).toLocaleString('he-IL')}
                            </td>

                            <td className="py-2 px-3">
                              {r.roomId ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
                                      {r.roomCode}
                                    </span>
                                    <span className="font-semibold text-white truncate max-w-[140px]" title={r.roomName || ''}>
                                      {r.roomName}
                                    </span>
                                  </div>
                                  {r.rawRoom !== r.roomName && (
                                    <div className="text-[10px] text-gray-500 truncate max-w-[180px]" title={r.rawRoom}>
                                      מקור: {r.rawRoom}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-rose-400 flex items-center gap-1 text-[11px]">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[160px]" title={r.rawRoom}>
                                    לא זוהה: "{r.rawRoom}"
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="py-2 px-3 font-mono font-bold text-white">
                              {r.masha || <span className="text-rose-400">חסר</span>}
                            </td>

                            <td className="py-2 px-3">
                              {r.isIrrelevantSN ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                    ריק (הערה נשמרה)
                                  </span>
                                  <div className="text-[10px] text-gray-400 truncate max-w-[180px]" title={r.snNote || ''}>
                                    "{r.snNote}"
                                  </div>
                                </div>
                              ) : r.serialNumber ? (
                                <span className="font-mono text-emerald-300 font-medium">
                                  {r.serialNumber}
                                </span>
                              ) : (
                                <span className="text-gray-500 font-mono text-[11px]">ללא S/N</span>
                              )}
                            </td>

                            <td className="py-2 px-3">
                              {r.willImport ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <Check className="w-3 h-3" />
                                  תקין לייבוא
                                </span>
                              ) : r.isDuplicate ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-help"
                                  title={r.duplicateReason}
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  כפילות (יסונן)
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 cursor-help"
                                  title={r.errorMessage}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  שגיאה
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-10 space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">הסריקות יובאו בהצלחה!</h4>
                <p className="text-xs sm:text-sm text-gray-300">
                  נוספו <strong className="text-emerald-400">{insertedCount}</strong> סריקות היסטוריות למערכת.
                </p>
                {parseResult && parseResult.duplicatesCount > 0 && (
                  <p className="text-xs text-amber-400">
                    {parseResult.duplicatesCount} כפילויות סוננו ולא נשמרו.
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                חריגות המיקום ודוחות המלאי חושבו מחדש ומעודכנים כעת בכלל המסכים.
              </p>
            </div>
          )}
          </>
        )}

        </DialogBody>

        {/* Modal Footer */}
        <DialogFooter className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gray-950/70">
          <div>
            {mainTab === 'upload' && step === 'preview' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={saving}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                בחר קובץ אחר
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mainTab === 'history' ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleClose}
              >
                סגור
              </Button>
            ) : step !== 'success' ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  disabled={analyzing || saving}
                >
                  ביטול
                </Button>

                {step === 'upload' ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleParseFile}
                    disabled={!file || analyzing}
                    loading={analyzing}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>טען ובדוק נתונים</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleCommitImport}
                    disabled={saving || !parseResult || parseResult.validRowsCount === 0}
                    loading={saving}
                  >
                    <Check className="w-4 h-4" />
                    <span>שמור {parseResult?.validRowsCount || 0} סריקות במערכת</span>
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleClose}
              >
                סגור ורענן תצוגה
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
