/**
 * Utilities for normalizing and extracting Masha (catalog / מק"ט / מסח"א) identifiers and descriptions.
 * 
 * In military/organizational inventory systems, Masha fields frequently appear in combined formats:
 *   "943121160 - מחשב"
 *   "943121186 – מסך LED 24\""
 *   "941817298 : מתג KVM 2:4"
 *   " 943121160 "
 *   943121160 (numeric)
 */

export interface ParsedMasha {
  masha: string;
  description: string;
}

/**
 * Parses a raw Masha string/number, splitting into a clean catalog identifier and an optional item description.
 */
export function parseMashaString(rawMasha: any, fallbackDesc?: string): ParsedMasha {
  if (rawMasha === undefined || rawMasha === null) {
    return { masha: '', description: fallbackDesc ? String(fallbackDesc).trim() : '' };
  }

  const str = String(rawMasha).trim();
  if (!str) {
    return { masha: '', description: fallbackDesc ? String(fallbackDesc).trim() : '' };
  }

  // Check for "<catalog_code> <separator> <description>"
  // Separators include dash '-', en-dash '–', em-dash '—', colon ':'
  const delimiterMatch = str.match(/^([A-Za-z0-9]+)\s*[-:–—]\s*(.+)$/);
  if (delimiterMatch) {
    const code = delimiterMatch[1].trim();
    const desc = delimiterMatch[2].trim();
    return {
      masha: code,
      description: desc || (fallbackDesc ? String(fallbackDesc).trim() : '')
    };
  }

  return {
    masha: str,
    description: fallbackDesc ? String(fallbackDesc).trim() : ''
  };
}

/**
 * Returns just the normalized catalog code (Masha / מק"ט), stripping any trailing description or spaces.
 */
export function normalizeMashaCode(rawMasha: any): string {
  return parseMashaString(rawMasha).masha;
}

/**
 * Cleans and validates serial numbers, filtering out Hebrew descriptive words, notes, or placeholders.
 */
export function cleanSerialNumber(rawSn: any): { serialNumber: string | null; isIrrelevant: boolean; note: string | null } {
  if (rawSn === undefined || rawSn === null) {
    return { serialNumber: null, isIrrelevant: false, note: null };
  }

  const str = String(rawSn).trim();
  if (!str) {
    return { serialNumber: null, isIrrelevant: false, note: null };
  }

  // Check for Hebrew characters (U+0590 to U+05FF)
  const hasHebrew = /[\u0590-\u05FF]/.test(str);

  // Common placeholder values
  const upper = str.toUpperCase();
  const placeholders = [
    'N/A', 'NA', 'NONE', 'NULL', 'NO S/N', 'NO-SN', 'NO_SN',
    'UNKNOWN', 'UNDEFINED', '-', '--', '?', 'ללא', 'אין',
    'אין סריאלי', 'בלי סריאלי', 'אין מדבקה', 'בלי מדבקה',
    'לא ידוע', 'ללא מספר', 'אין מספר'
  ];

  const isPlaceholder = placeholders.includes(upper) || /^0+$/.test(str) || /^[-_?.]+$/.test(str);

  if (hasHebrew || isPlaceholder) {
    return {
      serialNumber: null,
      isIrrelevant: true,
      note: str
    };
  }

  return {
    serialNumber: str.toUpperCase(),
    isIrrelevant: false,
    note: null
  };
}
