import {
  Monitor,
  Laptop,
  Tv,
  Printer,
  Fingerprint,
  Network,
  Server,
  Smartphone,
  Tablet,
  Camera,
  Projector,
  Zap,
  Keyboard,
  Box,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryTheme {
  textColor: string;
  bgColor: string;
  borderColor: string;
  gradientBg: string;
  ringColor: string;
  badgeBg: string;
}

export interface CategoryDefinition {
  id: string;
  labelHe: string;
  labelEn: string;
  shortLabelHe: string;
  icon: LucideIcon;
  theme: CategoryTheme;
  aliases: string[];
  descriptionHe: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'computer',
    labelHe: 'מחשב (תחנת עבודה / Tower / Mini)',
    labelEn: 'Computer / PC / Workstation',
    shortLabelHe: 'מחשב',
    icon: Monitor,
    theme: {
      textColor: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      gradientBg: 'from-blue-600/20 to-cyan-600/20',
      ringColor: 'ring-blue-500/40',
      badgeBg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    },
    aliases: [
      'מחשב',
      'מחשב נייח',
      'מחשבים',
      'תחנת עבודה',
      'תחנת עבודה רגילה',
      'תחנת עבודה זעירה',
      'עמדת עבודה',
      'מחשב שולחני',
      'מיני מחשב',
      'מיני פיסי',
      'pc',
      'computer',
      'desktop',
      'workstation',
      'regular workstation',
      'tower pc',
      'tower',
      'mini workstation',
      'mini pc',
      'nuc',
    ],
    descriptionHe: 'מחשב נייח, תחנת עבודה רגילה, Tower או Mini PC',
  },
  {
    id: 'laptop',
    labelHe: 'מחשב נייד (Laptop)',
    labelEn: 'Laptop / Notebook',
    shortLabelHe: 'מחשב נייד',
    icon: Laptop,
    theme: {
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      gradientBg: 'from-purple-600/20 to-indigo-600/20',
      ringColor: 'ring-purple-500/40',
      badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    },
    aliases: [
      'מחשב נייד',
      'נייד',
      'ניידים',
      'לפטופ',
      'לפטופים',
      'מחברת',
      'נוטבוק',
      'laptop',
      'notebook',
      'thinkpad',
      'macbook',
      'portable pc',
    ],
    descriptionHe: 'מחשב נייד, לפטופ עסקי או נישא',
  },
  {
    id: 'screen',
    labelHe: 'מסך מחשב (Screen / Monitor)',
    labelEn: 'Screen / Monitor',
    shortLabelHe: 'מסך',
    icon: Monitor,
    theme: {
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      gradientBg: 'from-emerald-600/20 to-teal-600/20',
      ringColor: 'ring-emerald-500/40',
      badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
    aliases: [
      'מסך',
      'צג',
      'מסכים',
      'צגים',
      'מסך מחשב',
      'screen',
      'monitor',
      'display',
    ],
    descriptionHe: 'מסך מחשב שולחני או צג עבודה',
  },
  {
    id: 'tv',
    labelHe: 'טלוויזיה / מסך תצוגה (TV)',
    labelEn: 'TV / Display Screen',
    shortLabelHe: 'טלוויזיה',
    icon: Tv,
    theme: {
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      gradientBg: 'from-amber-600/20 to-orange-600/20',
      ringColor: 'ring-amber-500/40',
      badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    aliases: [
      'טלוויזיה',
      'טלויזיה',
      'מסך תצוגה',
      'פלזמה',
      'tv',
      'television',
      'display screen',
      'smart tv',
    ],
    descriptionHe: 'טלוויזיה, מסך חדר ישיבות או פאנל תצוגה גדול',
  },
  {
    id: 'printer',
    labelHe: 'מדפסת (Printer / MFP)',
    labelEn: 'Printer / MFP',
    shortLabelHe: 'מדפסת',
    icon: Printer,
    theme: {
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      gradientBg: 'from-yellow-600/20 to-amber-600/20',
      ringColor: 'ring-yellow-500/40',
      badgeBg: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    },
    aliases: [
      'מדפסת',
      'מדפסות',
      'הדפסה',
      'משולבת',
      'מדפסת משולבת',
      'מדפסת רשת',
      'מדפסת לייזר',
      'printer',
      'mfp',
      'laser printer',
      'plotter',
    ],
    descriptionHe: 'מדפסת שולחנית, רשתית או מכשיר משולב',
  },
  {
    id: 'scanner',
    labelHe: 'סורק (אצבע / מסמכים / ברקוד)',
    labelEn: 'Scanner / Fingerprint',
    shortLabelHe: 'סורק',
    icon: Fingerprint,
    theme: {
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      gradientBg: 'from-rose-600/20 to-pink-600/20',
      ringColor: 'ring-rose-500/40',
      badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    },
    aliases: [
      'סורק',
      'סורקים',
      'סריקה',
      'סורק טביעת אצבע',
      'סורק אצבע',
      'טביעת אצבע',
      'סורק מסמכים',
      'סורק ברקוד',
      'scanner',
      'fingerprint',
      'fingerprint scanner',
      'barcode scanner',
      'document scanner',
    ],
    descriptionHe: 'סורק טביעות אצבע, סורק מסמכים או ברקוד',
  },
  {
    id: 'switch',
    labelHe: 'מתג / נתב רשת (Switch / Router)',
    labelEn: 'Network Switch / Router',
    shortLabelHe: 'מתג רשת',
    icon: Network,
    theme: {
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      gradientBg: 'from-cyan-600/20 to-sky-600/20',
      ringColor: 'ring-cyan-500/40',
      badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    },
    aliases: [
      'מתג',
      'סוויץ',
      'סוויץ\'',
      'סוויטש',
      'מתג רשת',
      'מתג תצוגה',
      'נתב',
      'ראוטר',
      'רשת',
      'switch',
      'network',
      'network switch',
      'router',
      'hub',
    ],
    descriptionHe: 'מתג רשת, סוויץ׳, נתב או ציוד תקשורת',
  },
  {
    id: 'server',
    labelHe: 'שרת / ארון תקשורת (Server / Rack)',
    labelEn: 'Server / Rack',
    shortLabelHe: 'שרת',
    icon: Server,
    theme: {
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      gradientBg: 'from-red-600/20 to-rose-600/20',
      ringColor: 'ring-red-500/40',
      badgeBg: 'bg-red-500/15 text-red-300 border-red-500/30',
    },
    aliases: [
      'שרת',
      'שרתים',
      'ארון תקשורת',
      'ארון שרתים',
      'server',
      'rack',
      'blade',
    ],
    descriptionHe: 'שרת פיזי, שרת להב או ארון שרתים',
  },
  {
    id: 'phone',
    labelHe: 'טלפון / סלולרי (Phone / IP Phone)',
    labelEn: 'Phone / IP Phone',
    shortLabelHe: 'טלפון',
    icon: Smartphone,
    theme: {
      textColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      gradientBg: 'from-green-600/20 to-emerald-600/20',
      ringColor: 'ring-green-500/40',
      badgeBg: 'bg-green-500/15 text-green-300 border-green-500/30',
    },
    aliases: [
      'טלפון',
      'טלפונים',
      'סלולר',
      'סלולרי',
      'סמארטפון',
      'שלוחה',
      'טלפון ip',
      'phone',
      'smartphone',
      'mobile',
      'ip phone',
      'voip',
    ],
    descriptionHe: 'טלפון שולחני IP, מכשיר סלולרי או שלוחה',
  },
  {
    id: 'tablet',
    labelHe: 'טאבלט / מסוף נייד (Tablet / iPad)',
    labelEn: 'Tablet / iPad',
    shortLabelHe: 'טאבלט',
    icon: Tablet,
    theme: {
      textColor: 'text-fuchsia-400',
      bgColor: 'bg-fuchsia-500/10',
      borderColor: 'border-fuchsia-500/30',
      gradientBg: 'from-fuchsia-600/20 to-purple-600/20',
      ringColor: 'ring-fuchsia-500/40',
      badgeBg: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    },
    aliases: [
      'טאבלט',
      'טאבלטים',
      'אייפד',
      'מסוף נייד',
      'לוח',
      'tablet',
      'ipad',
    ],
    descriptionHe: 'טאבלט, אייפד או מסוף עבודה נייד',
  },
  {
    id: 'camera',
    labelHe: 'מצלמה / מצלמת רשת (Camera / Webcam)',
    labelEn: 'Camera / Webcam',
    shortLabelHe: 'מצלמה',
    icon: Camera,
    theme: {
      textColor: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/30',
      gradientBg: 'from-indigo-600/20 to-blue-600/20',
      ringColor: 'ring-indigo-500/40',
      badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    },
    aliases: [
      'מצלמה',
      'מצלמות',
      'מצלמת רשת',
      'מצלמת אבטחה',
      'camera',
      'webcam',
    ],
    descriptionHe: 'מצלמת רשת, מצלמת ועידה או אבטחה',
  },
  {
    id: 'projector',
    labelHe: 'מקרן (Projector)',
    labelEn: 'Projector',
    shortLabelHe: 'מקרן',
    icon: Projector,
    theme: {
      textColor: 'text-lime-400',
      bgColor: 'bg-lime-500/10',
      borderColor: 'border-lime-500/30',
      gradientBg: 'from-lime-600/20 to-green-600/20',
      ringColor: 'ring-lime-500/40',
      badgeBg: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    },
    aliases: [
      'מקרן',
      'מקרנים',
      'ברקו',
      'projector',
    ],
    descriptionHe: 'מקרן לחדרי הדרכה וישיבות',
  },
  {
    id: 'ups',
    labelHe: 'אל-פסק / ספק כוח (UPS / Power)',
    labelEn: 'UPS / Power Supply',
    shortLabelHe: 'אל-פסק',
    icon: Zap,
    theme: {
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      gradientBg: 'from-yellow-600/20 to-amber-600/20',
      ringColor: 'ring-yellow-500/40',
      badgeBg: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    },
    aliases: [
      'אל-פסק',
      'אל פסק',
      'אלפסק',
      'ספק כוח',
      'סוללה',
      'ups',
      'power supply',
      'battery',
    ],
    descriptionHe: 'מערכת אל-פסק, גיבוי חשמל או ספק כוח',
  },
  {
    id: 'peripherals',
    labelHe: 'ציוד היקפי (מקלדת / עכבר / אוזניות)',
    labelEn: 'Peripherals (Keyboard / Mouse)',
    shortLabelHe: 'ציוד היקפי',
    icon: Keyboard,
    theme: {
      textColor: 'text-slate-300',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      gradientBg: 'from-slate-600/20 to-gray-600/20',
      ringColor: 'ring-slate-500/40',
      badgeBg: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    },
    aliases: [
      'ציוד היקפי',
      'מקלדת',
      'מקלדות',
      'עכבר',
      'עכברים',
      'אוזניות',
      'רמקול',
      'keyboard',
      'mouse',
      'headset',
      'speaker',
      'peripherals',
    ],
    descriptionHe: 'מקלדת, עכבר, ציוד קול או היקפי',
  },
  {
    id: 'other',
    labelHe: 'ציוד אחר / כללי',
    labelEn: 'Other / General Equipment',
    shortLabelHe: 'ציוד כללי',
    icon: Box,
    theme: {
      textColor: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/30',
      gradientBg: 'from-gray-600/20 to-zinc-600/20',
      ringColor: 'ring-gray-500/40',
      badgeBg: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    },
    aliases: [
      'אחר',
      'ציוד',
      'כללי',
      'שונות',
      'other',
      'general',
      'equipment',
    ],
    descriptionHe: 'ציוד שלא הוגדר לו סיווג ספציפי',
  },
];

const DEFAULT_CATEGORY = CATEGORIES.find((c) => c.id === 'other')!;
const COMPUTER_CATEGORY = CATEGORIES.find((c) => c.id === 'computer')!;

/**
 * Resolves any raw category string (Hebrew, English, acronym, or messy text)
 * into a structured CategoryDefinition with icon, logo badge styling, and labels.
 */
export function resolveCategory(rawCategory?: string | null): CategoryDefinition {
  if (!rawCategory) return COMPUTER_CATEGORY;

  const clean = rawCategory
    .trim()
    .toLowerCase()
    .replace(/["'״״]/g, '');

  if (!clean) return COMPUTER_CATEGORY;

  // 1. Exact alias match
  for (const cat of CATEGORIES) {
    if (cat.aliases.some((alias) => alias.toLowerCase() === clean)) {
      return cat;
    }
  }

  // 2. Keyword / Substring heuristics
  if (clean.includes('נייד') || clean.includes('laptop') || clean.includes('notebook')) {
    return CATEGORIES.find((c) => c.id === 'laptop')!;
  }

  if (clean.includes('סורק') || clean.includes('טביעת אצבע') || clean.includes('scanner') || clean.includes('barcode')) {
    return CATEGORIES.find((c) => c.id === 'scanner')!;
  }

  if (clean.includes('טלוויזיה') || clean.includes('טלויזיה') || clean === 'tv' || clean.includes('television')) {
    return CATEGORIES.find((c) => c.id === 'tv')!;
  }

  if (clean.includes('מסך') || clean.includes('צג') || clean.includes('screen') || clean.includes('monitor') || clean.includes('display')) {
    return CATEGORIES.find((c) => c.id === 'screen')!;
  }

  if (clean.includes('מדפסת') || clean.includes('printer') || clean.includes('משולבת')) {
    return CATEGORIES.find((c) => c.id === 'printer')!;
  }

  if (clean.includes('מתג') || clean.includes('סוויץ') || clean.includes('switch') || clean.includes('נתב') || clean.includes('router') || clean.includes('רשת')) {
    return CATEGORIES.find((c) => c.id === 'switch')!;
  }

  if (clean.includes('שרת') || clean.includes('server') || clean.includes('rack')) {
    return CATEGORIES.find((c) => c.id === 'server')!;
  }

  if (clean.includes('טלפון') || clean.includes('סלולר') || clean.includes('phone') || clean.includes('smartphone')) {
    return CATEGORIES.find((c) => c.id === 'phone')!;
  }

  if (clean.includes('טאבלט') || clean.includes('אייפד') || clean.includes('tablet') || clean.includes('ipad')) {
    return CATEGORIES.find((c) => c.id === 'tablet')!;
  }

  if (clean.includes('מצלמה') || clean.includes('camera') || clean.includes('webcam')) {
    return CATEGORIES.find((c) => c.id === 'camera')!;
  }

  if (clean.includes('מקרן') || clean.includes('projector') || clean.includes('ברקו')) {
    return CATEGORIES.find((c) => c.id === 'projector')!;
  }

  if (clean.includes('אל-פסק') || clean.includes('אל פסק') || clean.includes('אלפסק') || clean.includes('ups')) {
    return CATEGORIES.find((c) => c.id === 'ups')!;
  }

  if (clean.includes('מקלדת') || clean.includes('עכבר') || clean.includes('keyboard') || clean.includes('mouse') || clean.includes('היקפי')) {
    return CATEGORIES.find((c) => c.id === 'peripherals')!;
  }

  // "מחשב is computer"
  if (
    clean.includes('מחשב') ||
    clean.includes('עמדת עבודה') ||
    clean.includes('תחנת עבודה') ||
    clean.includes('pc') ||
    clean.includes('workstation') ||
    clean.includes('computer') ||
    clean.includes('tower') ||
    clean.includes('mini')
  ) {
    return COMPUTER_CATEGORY;
  }

  return DEFAULT_CATEGORY;
}

/**
 * Checks whether a given category string matches a search query in Hebrew or English.
 */
export function matchesCategorySearch(category: string | undefined | null, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  const raw = (category || '').toLowerCase();
  if (raw.includes(q)) return true;

  const resolved = resolveCategory(category);
  if (resolved.labelHe.toLowerCase().includes(q)) return true;
  if (resolved.shortLabelHe.toLowerCase().includes(q)) return true;
  if (resolved.labelEn.toLowerCase().includes(q)) return true;
  if (resolved.aliases.some((a) => a.toLowerCase().includes(q))) return true;

  return false;
}

/**
 * List of standard category choices to display in MashaEditModal and filter dropdowns.
 */
export const EDITABLE_CATEGORIES: Array<{
  value: string;
  labelHe: string;
  labelEn: string;
  categoryId: string;
}> = [
  { value: 'Regular Workstation', labelHe: 'מחשב (תחנת עבודה רגילה)', labelEn: 'Regular Workstation', categoryId: 'computer' },
  { value: 'Tower PC', labelHe: 'מחשב נייח Tower', labelEn: 'Tower PC', categoryId: 'computer' },
  { value: 'Mini Workstation', labelHe: 'תחנת עבודה זעירה / Mini', labelEn: 'Mini Workstation', categoryId: 'computer' },
  { value: 'Laptop', labelHe: 'מחשב נייד (Laptop)', labelEn: 'Laptop', categoryId: 'laptop' },
  { value: 'Screen', labelHe: 'מסך מחשב (Screen)', labelEn: 'Screen / Monitor', categoryId: 'screen' },
  { value: 'Switch', labelHe: 'מתג תצוגה / רשת (Switch)', labelEn: 'Switch / Router', categoryId: 'switch' },
  { value: 'Printer', labelHe: 'מדפסת (Printer)', labelEn: 'Printer', categoryId: 'printer' },
  { value: 'TV', labelHe: 'טלוויזיה / מסך תצוגה (TV)', labelEn: 'TV / Display', categoryId: 'tv' },
  { value: 'Scanner', labelHe: 'סורק טביעת אצבע (Fingerprint)', labelEn: 'Fingerprint Scanner', categoryId: 'scanner' },
  { value: 'Server', labelHe: 'שרת / ארון תקשורת (Server)', labelEn: 'Server / Rack', categoryId: 'server' },
  { value: 'Phone', labelHe: 'טלפון / IP Phone', labelEn: 'Phone', categoryId: 'phone' },
  { value: 'Tablet', labelHe: 'טאבלט (Tablet / iPad)', labelEn: 'Tablet', categoryId: 'tablet' },
  { value: 'Other', labelHe: 'ציוד אחר (Other)', labelEn: 'Other', categoryId: 'other' },
];
