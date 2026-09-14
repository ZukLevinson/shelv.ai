import * as XLSX from 'xlsx';

export interface ExcelColumn<T> {
  header: string;
  accessor: (item: T) => string | number | null | undefined;
}

export function exportToExcel<T>({
  filename,
  sheetName = 'Sheet1',
  columns,
  data,
}: {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn<T>[];
  data: T[];
}) {
  const formattedData = data.map((item) => {
    const row: Record<string, string | number> = {};
    columns.forEach((col) => {
      const val = col.accessor(item);
      row[col.header] = val ?? '';
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  // Set RTL on sheet view if possible
  (worksheet as any)['!views'] = [{ rightToLeft: true }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, finalName);
}
