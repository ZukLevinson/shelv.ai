import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Search,
  User,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Trash2,
  History,
  FileSpreadsheet,
  X,
  ArrowRightLeft,
  RotateCw,
  Clock,
  ShieldAlert,
  Tag,
  Monitor,
  Laptop,
  Printer,
  Tv,
  Fingerprint,
  Box
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import type { ScanObservation, ScanInvestigationData, Room } from '../types';

interface Props {
  rooms: Room[];
}

export const ScanManagement: React.FC<Props> = ({ rooms }) => {
  const [scans, setScans] = useState<ScanObservation[]>([]);
  const [scanners, setScanners] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters: who (scannedBy), what (search), where (roomId), when (startDate, endDate), status (mismatchOnly)
  const [search, setSearch] = useState('');
  const [selectedScanner, setSelectedScanner] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mismatchOnly, setMismatchOnly] = useState(false);

  // Investigation modal state
  const [investigatingSN, setInvestigatingSN] = useState<string | null>(null);
  const [investigationData, setInvestigationData] = useState<ScanInvestigationData | null>(null);
  const [investigationLoading, setInvestigationLoading] = useState(false);

  // Deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchScanners = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/sweep/scanners`);
      setScanners(res.data || []);
    } catch (err) {
      console.error('Failed to fetch scanners:', err);
    }
  };

  const fetchScans = async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: 300,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedScanner !== 'all') params.scannedBy = selectedScanner;
      if (selectedRoom !== 'all') params.roomId = selectedRoom;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (mismatchOnly) params.mismatchOnly = 'true';

      const res = await axios.get(`${API_BASE_URL}/api/sweep/scans`, { params });
      setScans(res.data.scans || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch scans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScanners();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchScans();
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, selectedScanner, selectedRoom, startDate, endDate, mismatchOnly]);

  const openInvestigation = async (sn: string) => {
    setInvestigatingSN(sn);
    setInvestigationLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/sweep/scans/investigate/${encodeURIComponent(sn)}`);
      setInvestigationData(res.data);
    } catch (err) {
      console.error('Failed to fetch investigation details:', err);
    } finally {
      setInvestigationLoading(false);
    }
  };

  const closeInvestigation = () => {
    setInvestigatingSN(null);
    setInvestigationData(null);
  };

  const handleDeleteScan = async (id: string, sn: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את רשומת הסריקה של S/N ${sn}? החריגות יחושבו מחדש מיד.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await axios.delete(`${API_BASE_URL}/api/sweep/scans/${id}`);
      setScans((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      fetchScanners();
    } catch (err) {
      console.error('Failed to delete scan:', err);
      alert('שגיאה בעת מחיקת הסריקה');
    } finally {
      setDeletingId(null);
    }
  };

  // Export filtered scans to CSV
  const handleExportCSV = () => {
    if (scans.length === 0) return;
    const headers = [
      'תאריך ושעה',
      'מספר סידורי',
      'מסח"א',
      'תיאור',
      'קטגוריה',
      'מי סרק',
      'חדר נסרק',
      'בעל מצאי החדר',
      'חדר רשמי באקסל',
      'בעל מצאי רשמי',
      'סטטוס התאמה'
    ];

    const rows = scans.map((s) => [
      `"${new Date(s.scanned_at).toLocaleString('he-IL')}"`,
      `"${s.serial_number}"`,
      `"${s.masha || ''}"`,
      `"${(s.item_description || '').replace(/"/g, '""')}"`,
      `"${s.category}"`,
      `"${s.scanned_by}"`,
      `"${s.scanned_room_name} (${s.scanned_room_code})"`,
      `"${s.scanned_holder_name}"`,
      `"${s.official_room_name ? `${s.official_room_name} (${s.official_room_code})` : 'לא קיים באקסל'}"`,
      `"${s.official_holder_name || 'לא ידוע'}"`,
      `"${s.scan_status === 'matched' ? 'תואם חתימה' : s.scan_status === 'mismatch' ? 'חריגת מיקום / חתימה' : 'לא רשום באקסל'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `shelv_scans_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick preset dates
  const setQuickDate = (preset: 'today' | 'week' | 'all') => {
    const today = new Date();
    if (preset === 'today') {
      const dateStr = today.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (preset === 'week') {
      const prevWeek = new Date(today);
      prevWeek.setDate(today.getDate() - 7);
      setStartDate(prevWeek.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Metrics derived from current list
  const metrics = useMemo(() => {
    const uniqueItems = new Set(scans.map((s) => s.serial_number)).size;
    const uniqueScanners = new Set(scans.map((s) => s.scanned_by)).size;
    const mismatches = scans.filter((s) => s.scan_status === 'mismatch').length;
    const unregistered = scans.filter((s) => s.scan_status === 'unregistered').length;
    return { uniqueItems, uniqueScanners, mismatches, unregistered };
  }, [scans]);

  const getCategoryIcon = (category: string) => {
    switch ((category || '').toLowerCase()) {
      case 'pc': return <Monitor className="w-4 h-4 text-blue-400" />;
      case 'laptop': return <Laptop className="w-4 h-4 text-purple-400" />;
      case 'printer': return <Printer className="w-4 h-4 text-amber-400" />;
      case 'screen': case 'tv': return <Tv className="w-4 h-4 text-emerald-400" />;
      case 'scanner': return <Fingerprint className="w-4 h-4 text-rose-400" />;
      default: return <Box className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>סך סריקות שנמצאו</span>
            <History className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2">{total}</div>
          <div className="text-[11px] text-gray-500 mt-1">רשומות סריקה לפי הסינון הנוכחי</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>פריטים ייחודיים שנסרקו</span>
            <Tag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 mt-2">{metrics.uniqueItems}</div>
          <div className="text-[11px] text-gray-500 mt-1">מספרים סידוריים שונים שזוהו</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>סורקים פעילים (Who)</span>
            <User className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 mt-2">{metrics.uniqueScanners}</div>
          <div className="text-[11px] text-gray-500 mt-1">אנשי צוות שביצעו סריקות</div>
        </div>

        <div className="bg-gray-900 border border-rose-900/30 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-rose-300 text-xs">
            <span>חריגות מיקום שזוהו</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2">{metrics.mismatches}</div>
          <div className="text-[11px] text-rose-300/70 mt-1">נמצאו בחדר אחר מזה שחתום עליו</div>
        </div>
      </div>

      {/* Filter Toolbar ("מי סרק, מה, איפה ומתי") */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-white">כלי תחקור וניהול סריקות מלאי</h2>
            <span className="text-[11px] sm:text-xs text-gray-400 hidden sm:inline">(מי, מה, איפה ומתי)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchScans()}
              disabled={loading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-xl transition-all"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>רענן נתונים</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={scans.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ייצוא CSV</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* מה (What): Serial / Masha / Keyword */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              מה? (S/N, מסח״א, תיאור פריט)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="הקלד לחיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* מי (Who): Scanner name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              מי סרק? (שם הסורק)
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedScanner}
                onChange={(e) => setSelectedScanner(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pr-9 pl-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 appearance-none"
              >
                <option value="all">כל הסורקים ({scanners.length})</option>
                {scanners.map((scanner) => (
                  <option key={scanner} value={scanner}>
                    {scanner}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* איפה (Where): Room */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 mb-1">
              איפה? (חדר שנסרק)
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pr-9 pl-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 appearance-none"
              >
                <option value="all">כל החדרים ({rooms.length})</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.code}) - {room.holder_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* מתי (When): Date range & quick buttons */}
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>מתי? (טווח תאריכים)</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickDate('today')}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 hover:text-white"
                >
                  היום
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('week')}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 hover:text-white"
                >
                  7 ימים
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('all')}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 hover:text-white"
                >
                  הכל
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
                placeholder="מתאריך"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
                placeholder="עד תאריך"
              />
            </div>
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 select-none">
            <input
              type="checkbox"
              checked={mismatchOnly}
              onChange={(e) => setMismatchOnly(e.target.checked)}
              className="w-4 h-4 rounded bg-gray-950 border-gray-700 text-rose-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>הצג רק חריגות מיקום / ללא חתימה</span>
            </span>
          </label>

          {(search || selectedScanner !== 'all' || selectedRoom !== 'all' || startDate || endDate || mismatchOnly) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedScanner('all');
                setSelectedRoom('all');
                setStartDate('');
                setEndDate('');
                setMismatchOnly(false);
              }}
              className="text-xs text-gray-400 hover:text-rose-400 transition-colors"
            >
              נקה את כל הסינונים
            </button>
          )}
        </div>
      </div>

      {/* Scans Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl max-w-full">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-right text-xs min-w-[820px]">
            <thead>
              <tr className="bg-gray-950/60 border-b border-gray-800 text-gray-400 font-semibold">
                <th className="py-3 px-4">מתי (זמן סריקה)</th>
                <th className="py-3 px-3">מי סרק</th>
                <th className="py-3 px-3">מה נסרק (S/N ומסח״א)</th>
                <th className="py-3 px-3">איפה נסרק בפועל</th>
                <th className="py-3 px-3">בעל מצאי רשמי (חתימה)</th>
                <th className="py-3 px-3">סטטוס התאמה</th>
                <th className="py-3 px-4 text-center">פעולות תחקור</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {scans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    {loading ? 'טוען סריקות...' : 'לא נמצאו סריקות התואמות את תנאי הסינון.'}
                  </td>
                </tr>
              ) : (
                scans.map((scan) => {
                  const isMismatch = scan.scan_status === 'mismatch';
                  const dateObj = new Date(scan.scanned_at);

                  return (
                    <tr
                      key={scan.id}
                      className={`hover:bg-gray-800/40 transition-colors ${
                        isMismatch ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* מתי */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-white font-medium">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{dateObj.toLocaleDateString('he-IL')}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* מי סרק */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 text-gray-200 font-medium">
                          <User className="w-3 h-3 text-purple-400" />
                          <span>{scan.scanned_by}</span>
                        </div>
                        {scan.sweep_id && (
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            סשן: {scan.sweep_id.slice(-8)}
                          </div>
                        )}
                      </td>

                      {/* מה נסרק */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded-lg bg-gray-800/80 mt-0.5 flex-shrink-0">
                            {getCategoryIcon(scan.category)}
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {scan.item_description}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px]">
                              <button
                                onClick={() => openInvestigation(scan.serial_number)}
                                className="text-emerald-400 hover:underline hover:text-emerald-300 font-bold"
                                title="לחץ לתחקור מלא של המספר הסידורי"
                              >
                                S/N: {scan.serial_number}
                              </button>
                              {scan.masha && (
                                <span className="text-gray-400 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">
                                  מסח"א: {scan.masha}
                                </span>
                              )}
                            </div>
                            {scan.sticker_owner_text && (
                              <div className="text-[10px] text-amber-300/80 mt-0.5">
                                מדבקה פיזית: {scan.sticker_owner_text}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* איפה נסרק בפועל */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-emerald-300 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{scan.scanned_room_name}</span>
                          <span className="font-mono text-gray-400">({scan.scanned_room_code})</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          אחראי חדר: {scan.scanned_holder_name}
                        </div>
                      </td>

                      {/* בעל מצאי רשמי באקסל */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {scan.official_holder_name ? (
                          <div>
                            <div className={`font-semibold ${isMismatch ? 'text-rose-400 font-bold' : 'text-gray-200'}`}>
                              {scan.official_holder_name}
                            </div>
                            {scan.official_room_name && (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                חדר ראשי: {scan.official_room_name} ({scan.official_room_code})
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic text-[11px]">
                            לא רשום באקסל
                          </div>
                        )}
                      </td>

                      {/* סטטוס התאמה */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {scan.scan_status === 'matched' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>תואם חתימה</span>
                          </span>
                        )}
                        {scan.scan_status === 'mismatch' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span>חריגת מיקום!</span>
                          </span>
                        )}
                        {scan.scan_status === 'unregistered' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>פריט לא באקסל</span>
                          </span>
                        )}
                      </td>

                      {/* פעולות */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openInvestigation(scan.serial_number)}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-300 transition-colors"
                            title="תחקור היסטוריית פריט"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteScan(scan.id, scan.serial_number)}
                            disabled={deletingId === scan.id}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors disabled:opacity-50"
                            title="מחק רשומת סריקה זו"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Drilldown Investigation Modal */}
      {investigatingSN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between bg-gray-950/40">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                  <History className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">תחקור פריט מלאי</h3>
                  <div className="text-xs text-gray-400">
                    מספר סידורי: <span className="font-mono text-emerald-400 font-bold">{investigatingSN}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeInvestigation}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-3.5 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6">
              {investigationLoading ? (
                <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
                  <RotateCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>טוען היסטוריית סריקות ורישומים...</span>
                </div>
              ) : (
                <>
                  {/* Official Baseline Information */}
                  <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <span className="text-xs font-bold text-gray-300">פרטי פריט רשמי (Baseline Data)</span>
                      {investigationData?.officialItem ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          רשום באקסל
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          פריט שלא נמצא ברשימת החתימות המקורית
                        </span>
                      )}
                    </div>

                    {investigationData?.officialItem ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-gray-500 text-[11px]">תיאור דגם:</div>
                          <div className="font-semibold text-white mt-0.5">
                            {investigationData.officialItem.masha_name || investigationData.officialItem.description}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[11px]">מסח"א:</div>
                          <div className="font-mono text-gray-300 mt-0.5">
                            {investigationData.officialItem.masha}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[11px]">חדר חתום:</div>
                          <div className="text-gray-300 mt-0.5">
                            {investigationData.officialItem.room_name} ({investigationData.officialItem.room_code})
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-[11px]">בעל מצאי חתום:</div>
                          <div className="text-gray-300 mt-0.5">
                            {investigationData.officialItem.holder_name}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">
                        פריט זה נסרק פיזית בשטח אך לא הופיע בקובץ האקסל המקורי.
                      </div>
                    )}
                  </div>

                  {/* Observations Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span>ציר זמן סריקות שבוצעו (מי סרק ואיפה)</span>
                    </h4>

                    {(!investigationData?.observations || investigationData.observations.length === 0) ? (
                      <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-500 text-center">
                        לא תועדו סריקות עבור פריט זה
                      </div>
                    ) : (
                      <div className="relative border-r-2 border-gray-800 mr-3 pr-4 space-y-4">
                        {investigationData.observations.map((obs) => {
                          const obsDate = new Date(obs.scanned_at);
                          const isMismatchWithOfficial =
                            investigationData.officialItem &&
                            investigationData.officialItem.room_id !== obs.room_id;

                          return (
                            <div key={obs.id} className="relative">
                              {/* Dot on timeline */}
                              <div className={`absolute -right-[23px] top-1.5 w-3 h-3 rounded-full border-2 bg-gray-900 ${
                                isMismatchWithOfficial ? 'border-rose-500' : 'border-emerald-500'
                              }`} />

                              <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800/80 space-y-2">
                                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{obs.room_name} ({obs.room_code})</span>
                                    <span className="text-gray-400">| אחראי: {obs.holder_name}</span>
                                    {isMismatchWithOfficial && (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                        חריגת מיקום ביחס לחתימה
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-gray-400 font-mono">
                                    {obsDate.toLocaleString('he-IL')}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-900">
                                  <div className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-purple-400" />
                                    <span>סורק: <strong className="text-gray-200">{obs.scanned_by}</strong></span>
                                  </div>
                                  {obs.sticker_owner_text && (
                                    <div className="text-amber-300">
                                      מדבקה: {obs.sticker_owner_text}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Anomaly Resolutions / Official Transfers History */}
                  {investigationData?.resolutions && investigationData.resolutions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                        <span>העברות ואישורי שינוי חתומים במערכת</span>
                      </h4>
                      <div className="space-y-2">
                        {investigationData.resolutions.map((res) => (
                          <div key={res.id} className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-300">
                                הועבר מ-{res.from_room_name || 'חדר קודם'} ({res.from_holder_name}) ל-{res.to_room_name || 'חדר יעד'} ({res.to_holder_name})
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {new Date(res.resolved_at).toLocaleString('he-IL')}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400">
                              אושר ונחתם ע"י: <strong className="text-gray-200">{res.resolved_by}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-950 border-t border-gray-800 flex justify-end">
              <button
                onClick={closeInvestigation}
                className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"
              >
                סגור תחקור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
