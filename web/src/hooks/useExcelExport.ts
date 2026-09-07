import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { exportInventoryToExcel } from '../utils/exportUtils';

export const useExcelExport = () => {
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = useCallback(async () => {
    setExporting(true);
    try {
      await exportInventoryToExcel(API_BASE_URL);
    } catch (err) {
      console.error('Failed to export Excel file:', err);
      alert('שגיאה בייצוא קובץ האקסל. אנא נסה שנית.');
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, handleExportExcel };
};
