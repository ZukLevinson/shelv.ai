import type { PageMeta } from '../types/navigation';

export const PAGE_METADATA: Record<string, PageMeta> = {
  '/': {
    title: 'מבט על וחריגות',
    description: 'מערכת ניהול, סריקת מלאי וזיהוי חריגות בעלי מצאי בארגון',
  },
  '/scans': {
    title: 'ניהול ותחקור סריקות',
    description: 'כלי תחקור וניהול סריקות מלאי בשטח (מי סרק, מה, איפה ומתי)',
  },
  '/holders': {
    title: 'בעלי מצאי',
    description: 'ניהול בעלי מצאי, הקצאת חדרים ומעקב אחר פריטים חתומים בארגון',
  },
  '/masha-registry': {
    title: 'הגדרת מסחאות',
    description: 'הגדרת סוגי ומפרטי מסח"א, קטגוריות ותיאורי ציוד רשמיים',
  },
  '/items': {
    title: 'קטלוג פריטים',
    description: 'מאגר פריטים פיזיים שנסרקו, מספרים סידוריים ופרטי מצאי',
  },
  '/users': {
    title: 'ניהול משתמשים',
    description: 'ניהול משתמשי המערכת, הרשאות ניהול ושיוך בעלי מצאי',
  },
};
