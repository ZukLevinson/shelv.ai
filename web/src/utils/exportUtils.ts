import axios from 'axios';

export const exportInventoryToExcel = async (apiBaseUrl: string): Promise<void> => {
  const response = await axios.get(`${apiBaseUrl}/api/inventory/export-excel`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  link.setAttribute('download', `shelv_inventory_export_${timestamp}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
