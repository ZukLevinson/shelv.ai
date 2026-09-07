import type { PageMeta } from '../types/navigation';
import { PAGE_METADATA } from '../constants/navigation';

export const getPageMeta = (pathname: string): PageMeta => {
  if (PAGE_METADATA[pathname]) return PAGE_METADATA[pathname];
  if (pathname === '/overview') return PAGE_METADATA['/'];
  if (pathname === '/masha') return PAGE_METADATA['/masha-registry'];
  if (pathname === '/catalog') return PAGE_METADATA['/items'];
  return {
    title: 'מבט על וחריגות',
    description: 'מערכת ניהול, סריקת מלאי וזיהוי חריגות בעלי מצאי בארגון',
  };
};
