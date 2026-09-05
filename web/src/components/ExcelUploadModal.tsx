import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, X, CheckCircle, AlertCircle, Download } from 'lucide-react';
import axios from 'axios';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExcelUploadModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

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
      const res = await axios.post('http://localhost:4000/api/upload-excel', formData);
      setResult(res.data.result);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'שגיאה בעת העלאת הקובץ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-lg text-white">ייבוא מצאי רשמי (אקסל)</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-400 leading-relaxed">
            העלה קובץ אקסל (.xlsx / .csv) לעדכון רשומות המצאי הרשמיות של הארגון.
            העמודות הנדרשות: <strong>Catalog # (מסח"א)</strong>, <strong>Serial Number (S/N)</strong>, <strong>תיאור</strong>, <strong>חדר</strong>, <strong>בעל מצאי</strong>.
          </p>

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
              href="http://localhost:4000/api/sample-excel"
              download
              className="flex items-center gap-1 text-emerald-400 hover:underline font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              הורד קובץ תבנית
            </a>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>עודכן בהצלחה! נוספו {result.insertedCount} פריטים, עודכנו {result.updatedCount}.</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-950/50 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="px-5 py-2 text-sm font-medium rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-all shadow-lg shadow-emerald-500/20"
          >
            {loading ? 'מייבא...' : 'ייבא נתונים'}
          </button>
        </div>
      </div>
    </div>
  );
};