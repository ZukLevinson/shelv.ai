import xlsx from 'xlsx';
import { db } from '../db/database.js';
import { detectAnomalies } from './anomalyService.js';

function autoFitColumns(data: Record<string, any>[]) {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    for (const row of data) {
      const val = row[key];
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        // Give Hebrew / Unicode characters slightly more width
        const len = Math.ceil(strVal.length * 1.15);
        if (len > maxLen) maxLen = len;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 12), 65) };
  });
}

export function generateExportWorkbookBuffer(): Buffer {
  // -------------------------------------------------------------
  // Sheet 1: רשימת סריקות (Scans List)
  // -------------------------------------------------------------
  const scansQuery = `
    SELECT 
      o.id as scan_id,
      o.scanned_at,
      o.scanned_by,
      r.code as scanned_room_code,
      r.name as scanned_room_name,
      h.name as scanned_holder_name,
      o.serial_number,
      o.masha,
      COALESCE(m.description, i.description, o.product_name_detected, 'ציוד') as item_description,
      COALESCE(m.category, i.category, 'Regular Workstation') as category,
      o.sticker_owner_text,
      CASE
        WHEN i.id IS NULL THEN 'לא רשום במצאי'
        WHEN i.holder_id != r.holder_id THEN 'חריגת שיוך (ציוד זר)'
        WHEN i.room_id IS NOT NULL AND i.room_id != r.id THEN 'הזזה פנימית בחדר אחר'
        ELSE 'תקין ותואם'
      END as scan_status,
      off_h.name as official_holder_name,
      off_r.name as official_room_name
    FROM sweep_observations o
    JOIN rooms r ON o.room_id = r.id
    JOIN inventory_holders h ON r.holder_id = h.id
    LEFT JOIN official_inventory i ON i.id = COALESCE(
      (SELECT i1.id FROM official_inventory i1 WHERE o.serial_number IS NOT NULL AND o.serial_number != '' AND i1.serial_number = o.serial_number LIMIT 1),
      (SELECT i2.id FROM official_inventory i2 WHERE i2.masha = o.masha AND i2.holder_id = r.holder_id LIMIT 1),
      (SELECT i3.id FROM official_inventory i3 WHERE i3.masha = o.masha LIMIT 1)
    )
    LEFT JOIN rooms off_r ON i.room_id = off_r.id
    LEFT JOIN inventory_holders off_h ON i.holder_id = off_h.id
    LEFT JOIN masha_registry m ON COALESCE(o.masha, i.masha) = m.masha
    ORDER BY o.scanned_at DESC
  `;

  const rawScans = db.prepare(scansQuery).all() as any[];
  const scansData = rawScans.length > 0 ? rawScans.map((row) => ({
    'מזהה סריקה': row.scan_id,
    'תאריך ושעת סריקה': row.scanned_at ? new Date(row.scanned_at).toLocaleString('he-IL') : '',
    'סורק': row.scanned_by || '',
    'קוד חדר': row.scanned_room_code || '',
    'שם חדר': row.scanned_room_name || '',
    'בעל המצאי של החדר': row.scanned_holder_name || '',
    'מספר סידורי (S/N)': row.serial_number || 'ללא מס"ד',
    'מסח"א': row.masha || '',
    'תיאור פריט': row.item_description || '',
    'קטגוריה': row.category || '',
    'מדבקת בעלים': row.sticker_owner_text || '',
    'סטטוס סריקה': row.scan_status || '',
    'בעל מצאי רשום (אקסל)': row.official_holder_name || 'לא רשום',
    'חדר רשום (אקסל)': row.official_room_name || 'לא שויך'
  })) : [{
    'מזהה סריקה': '',
    'תאריך ושעת סריקה': '',
    'סורק': '',
    'קוד חדר': '',
    'שם חדר': '',
    'בעל המצאי של החדר': '',
    'מספר סידורי (S/N)': '',
    'מסח"א': '',
    'תיאור פריט': 'אין עדיין סריקות במערכת',
    'קטגוריה': '',
    'מדבקת בעלים': '',
    'סטטוס סריקה': '',
    'בעל מצאי רשום (אקסל)': '',
    'חדר רשום (אקסל)': ''
  }];

  // -------------------------------------------------------------
  // Sheet 2: מצאי רשמי מתוקנן (Standardized Inventory)
  // -------------------------------------------------------------
  const inventoryQuery = `
    SELECT 
      i.id,
      i.masha,
      i.serial_number,
      COALESCE(m.description, i.description) as description,
      COALESCE(m.category, i.category, 'Regular Workstation') as category,
      h.name as holder_name,
      h.personal_number as holder_personal_number,
      r.code as room_code,
      r.name as room_name,
      e.filename as import_filename,
      COALESCE(i.updated_at, i.created_at) as record_date
    FROM official_inventory i
    JOIN inventory_holders h ON i.holder_id = h.id
    LEFT JOIN rooms r ON i.room_id = r.id
    LEFT JOIN masha_registry m ON i.masha = m.masha
    LEFT JOIN excel_imports e ON i.import_id = e.id
    ORDER BY h.name ASC, i.masha ASC
  `;

  const rawInventory = db.prepare(inventoryQuery).all() as any[];
  const inventoryData = rawInventory.length > 0 ? rawInventory.map((row) => ({
    'מסח"א (Catalog #)': row.masha || '',
    'תיאור פריט': row.description || '',
    'קטגוריה': row.category || '',
    'מספר סידורי (S/N)': row.serial_number || 'ללא מס"ד',
    'כמות': 1,
    'בעל מצאי': row.holder_name || '',
    'מספר אישי': row.holder_personal_number || '',
    'קוד חדר': row.room_code || '',
    'שם חדר': row.room_name || '',
    'קובץ מקור ייבוא': row.import_filename || 'הזנה ידנית / ברירת מחדל',
    'תאריך עדכון': row.record_date ? new Date(row.record_date).toLocaleString('he-IL') : ''
  })) : [{
    'מסח"א (Catalog #)': '',
    'תיאור פריט': 'אין פריטים במצאי הרשמי',
    'קטגוריה': '',
    'מספר סידורי (S/N)': '',
    'כמות': 0,
    'בעל מצאי': '',
    'מספר אישי': '',
    'קוד חדר': '',
    'שם חדר': '',
    'קובץ מקור ייבוא': '',
    'תאריך עדכון': ''
  }];

  // -------------------------------------------------------------
  // Sheet 3: חריגות ודגלים (Flags & Anomalies)
  // -------------------------------------------------------------
  const anomaliesReport = detectAnomalies();
  const flagsData: Record<string, any>[] = [];

  // 1. Unauthorized transfers / foreign items in room
  for (const item of anomaliesReport.unauthorizedTransfers || []) {
    flagsData.push({
      'סוג דגל / חריגה': 'ציוד זר בחדר (ללא חתימה מתאימה)',
      'חומרה': 'גבוהה',
      'מספר סידורי (S/N)': item.serialNumber || 'ללא מס"ד',
      'מסח"א': item.masha || '',
      'תיאור פריט': item.description || '',
      'קטגוריה': item.category || '',
      'בעל מצאי רשום / משוער': item.supposedHolderName || 'לא רשום באקסל החתימות',
      'חדר רשום (אם קיים)': item.officialRoomName || 'לא שויך',
      'בעל המצאי של החדר שנסרק': item.scannedHolderName || '',
      'חדר בו נסרק הפריט': item.scannedRoomName || '',
      'כמות חתומה': '',
      'כמות שנסרקה': 1,
      'פער חסר': '',
      'נסרק ע"י': item.scannedBy || '',
      'תאריך סריקה': item.scannedAt ? new Date(item.scannedAt).toLocaleString('he-IL') : '',
      'פירוט והערות': item.stickerOwnerText ? `מדבקת בעלים: ${item.stickerOwnerText}` : 'פריט זוהה בחדר של בעל מצאי שאינו חתום עליו'
    });
  }

  // 2. Quota discrepancies / shortage in holder's balance
  for (const q of anomaliesReport.quotaDiscrepancies || []) {
    flagsData.push({
      'סוג דגל / חריגה': 'פער חתימה חסר (חוסר במלאי)',
      'חומרה': 'בינונית',
      'מספר סידורי (S/N)': 'לכלל המסח"א',
      'מסח"א': q.masha || '',
      'תיאור פריט': q.description || '',
      'קטגוריה': q.category || '',
      'בעל מצאי רשום / משוער': q.holderName || '',
      'חדר רשום (אם קיים)': '',
      'בעל המצאי של החדר שנסרק': q.holderName || '',
      'חדר בו נסרק הפריט': '',
      'כמות חתומה': q.expectedQuantity,
      'כמות שנסרקה': q.actualDiscovered,
      'פער חסר': q.difference,
      'נסרק ע"י': '',
      'תאריך סריקה': '',
      'פירוט והערות': `חתימה על ${q.expectedQuantity} יח' באקסל אך אותרו רק ${q.actualDiscovered} יח' בחדריו (חסר ${Math.abs(q.difference)} יח')`
    });
  }

  // 3. Missing serialized items
  for (const m of anomaliesReport.missingItems || []) {
    flagsData.push({
      'סוג דגל / חריגה': 'פריט סריאלי לא אותר',
      'חומרה': 'גבוהה',
      'מספר סידורי (S/N)': m.serialNumber || '',
      'מסח"א': m.masha || '',
      'תיאור פריט': m.description || '',
      'קטגוריה': m.category || '',
      'בעל מצאי רשום / משוער': m.officialHolderName || '',
      'חדר רשום (אם קיים)': m.officialRoomName || 'ללא חדר משויך',
      'בעל המצאי של החדר שנסרק': '',
      'חדר בו נסרק הפריט': 'טרם נסרק',
      'כמות חתומה': 1,
      'כמות שנסרקה': 0,
      'פער חסר': -1,
      'נסרק ע"י': '',
      'תאריך סריקה': '',
      'פירוט והערות': 'פריט עם מספר סידורי רשום במצאי שטרם זוהה בסריקה פיזית כלשהי'
    });
  }

  // 4. Internal moves between rooms of the same holder
  for (const im of anomaliesReport.internalMoves || []) {
    flagsData.push({
      'סוג דגל / חריגה': 'הזזה פנימית בין חדרים',
      'חומרה': 'מידע',
      'מספר סידורי (S/N)': im.serialNumber || '',
      'מסח"א': im.masha || '',
      'תיאור פריט': im.description || '',
      'קטגוריה': im.category || '',
      'בעל מצאי רשום / משוער': im.holderName || '',
      'חדר רשום (אם קיים)': im.officialRoomName || '',
      'בעל המצאי של החדר שנסרק': im.holderName || '',
      'חדר בו נסרק הפריט': im.scannedRoomName || '',
      'כמות חתומה': 1,
      'כמות שנסרקה': 1,
      'פער חסר': 0,
      'נסרק ע"י': im.scannedBy || '',
      'תאריך סריקה': im.scannedAt ? new Date(im.scannedAt).toLocaleString('he-IL') : '',
      'פירוט והערות': `משויך לחדר "${im.officialRoomName}" אך נמצא בחדר "${im.scannedRoomName}" של אותו בעל מצאי`
    });
  }

  if (flagsData.length === 0) {
    flagsData.push({
      'סוג דגל / חריגה': 'אין חריגות במערכת',
      'חומרה': 'תקין',
      'מספר סידורי (S/N)': '',
      'מסח"א': '',
      'תיאור פריט': '',
      'קטגוריה': '',
      'בעל מצאי רשום / משוער': '',
      'חדר רשום (אם קיים)': '',
      'בעל המצאי של החדר שנסרק': '',
      'חדר בו נסרק הפריט': '',
      'כמות חתומה': '',
      'כמות שנסרקה': '',
      'פער חסר': '',
      'נסרק ע"י': '',
      'תאריך סריקה': '',
      'פירוט והערות': 'כל הפריטים, החתימות והסריקות תואמים במלואם!'
    });
  }

  // -------------------------------------------------------------
  // Construct Workbook
  // -------------------------------------------------------------
  const wb = xlsx.utils.book_new();

  const wsScans = xlsx.utils.json_to_sheet(scansData);
  wsScans['!cols'] = autoFitColumns(scansData);
  wsScans['!views'] = [{ rightToLeft: true }];
  xlsx.utils.book_append_sheet(wb, wsScans, 'רשימת סריקות');

  const wsInventory = xlsx.utils.json_to_sheet(inventoryData);
  wsInventory['!cols'] = autoFitColumns(inventoryData);
  wsInventory['!views'] = [{ rightToLeft: true }];
  xlsx.utils.book_append_sheet(wb, wsInventory, 'מצאי רשמי מתוקנן');

  const wsFlags = xlsx.utils.json_to_sheet(flagsData);
  wsFlags['!cols'] = autoFitColumns(flagsData);
  wsFlags['!views'] = [{ rightToLeft: true }];
  xlsx.utils.book_append_sheet(wb, wsFlags, 'חריגות ודגלים');

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
