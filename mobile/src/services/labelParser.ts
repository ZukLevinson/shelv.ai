export interface ParsedItemData {
  masha?: string;
  serialNumber?: string;
  productDescription?: string;
  stickerOwner?: string;
}

/**
 * Normalize OCR text errors where numbers are confused with look-alike letters
 * e.g., 'O' -> '0', 'l'/'I' -> '1', 'S' -> '5', 'B' -> '8'
 */
function normalizeDigits(str: string): string {
  return str
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Zz]/g, '2');
}

export function parseLabelText(rawText: string): ParsedItemData {
  const result: ParsedItemData = {};
  if (!rawText) return result;

  // Split lines and normalize basic punctuation
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  // Pass 1: Prioritize explicit "Catalog #" or Hebrew equivalents "מסח"א", "מס קטלוגי", "מק"ט", etc.
  // When there are multiple numbers on the same label (Customer Order #, Warranty, Phone, Serial),
  // we MUST strictly extract the number following Catalog / מסח"א first!
  const catalogRegex = /(?:Catalog\s*(?:#|No\.?|Num\.?|Number)?|Cat\s*#?|מס(?:ח"?א|\s*יי?א|\s*קטלוגי|\s*מצאי|\s*סידורי\s*של)?|מק"?ט)\s*[:#\-.\s]+([0-9A-Za-z\s\-]{6,16})/i;

  // Words that indicate non-catalog numbers on the same label
  const nonCatalogPrefixRegex = /(?:Customer\s*Order|Order\s*#|PO\s*#|הזמנה|Phone|טלפון|טל|Warranty|אחריות|Model|דגם|Date|תאריך)/i;

  for (const line of lines) {
    const cleanLine = line.replace(/[|\[\]{}~_]/g, ' ').trim();

    // If line explicitly contains Customer Order # or Phone, do not treat it as Catalog #
    if (nonCatalogPrefixRegex.test(cleanLine) && !/(?:Catalog|מס(?:ח"?א|יי?א|קטלוגי|מק"?ט))/i.test(cleanLine)) {
      continue;
    }

    const catMatch = cleanLine.match(catalogRegex);
    if (catMatch && !result.masha) {
      // Clean candidate and convert potential OCR char slips to digits
      const candidateDigits = normalizeDigits(catMatch[1]).replace(/[^0-9]/g, '');
      if (candidateDigits.length >= 6 && candidateDigits.length <= 14) {
        result.masha = candidateDigits;
      }
    }
  }

  // Pass 1.5: If not found per line, check across entire text block (in case "Catalog #" and digits were split by newline)
  if (!result.masha) {
    const multilineMatch = rawText.match(/(?:Catalog\s*(?:#|No\.?|Num\.?|Number)?|Cat\s*#?|מס(?:ח"?א|\s*יי?א|\s*קטלוגי|\s*מצאי)?|מק"?ט)[\s:#\-.\n]+([0-9A-Za-z\s]{6,16})/i);
    if (multilineMatch) {
      const candidateDigits = normalizeDigits(multilineMatch[1]).replace(/[^0-9]/g, '');
      if (candidateDigits.length >= 6 && candidateDigits.length <= 14) {
        result.masha = candidateDigits;
      }
    }
  }

  // Pass 2: Extract other metadata (S/N, Description, Owner) and fallback for handwritten Masha digits
  for (const line of lines) {
    const cleanLine = line.replace(/[|\[\]{}~_]/g, ' ').trim();

    // S/N matching with robust prefix variations (S/N, Serial No., Serial #, Serial, SN, מס"ד, מספר סידורי, סריאלי, etc.)
    const snMatch = cleanLine.match(/(?:Serial\s*(?:Number|No\.?|Num\.?|#)?|S\s*[\/\\.\-_:]\s*N|S\/N|S\.N\.|S_N|SN\b|מספר\s*סידורי|מס["'״]?ד|סריאלי)\s*[:#\-.]?\s*([A-Z0-9]{6,18})/i);
    if (snMatch && !result.serialNumber) {
      result.serialNumber = snMatch[1].toUpperCase();
    } else {
      // OEM HP/Lenovo/Dell format: e.g. 2UA80920XS, PF3XYZ12, 3CQ7290K11
      const hpSnMatch = cleanLine.match(/\b([0-9][A-Z]{2}[0-9]{5,7}[A-Z0-9]{1,3})\b/i);
      if (hpSnMatch && !result.serialNumber) {
        result.serialNumber = hpSnMatch[1].toUpperCase();
      }
    }

    // Product description
    const descMatch = cleanLine.match(/(?:Description|תיאור)\s*[:#\-.]?\s*(.+)/i);
    if (descMatch && !result.productDescription) {
      result.productDescription = descMatch[1].trim();
    } else if (/HP Elite|HP Pro|Lenovo ThinkPad|Dell UltraSharp|HP LaserJet|Dell OptiPlex/i.test(cleanLine) && !result.productDescription) {
      result.productDescription = cleanLine;
    }

    // Hebrew Sticker Owner (בעל מצאי)
    const ownerMatch = cleanLine.match(/(?:בעל\s*מצאי|בעלים|אחראי|שם)\s*[:#\-.]?\s*([א-ת\s"״]+)/);
    if (ownerMatch && !result.stickerOwner) {
      result.stickerOwner = ownerMatch[1].trim();
    }
  }

  // Pass 3: Handwritten Masha detection (pure sequence of 7 to 10 digits)
  // In handwritten stickers, there is often NO word "Catalog" or "מסח\"א" - only handwriting with numbers!
  // e.g. "943112961", "943121160", or spaced handwriting like "9 4 3 1 1 2 9 6 1"
  if (!result.masha) {
    for (const line of lines) {
      // Exclude lines that represent other numbers on the sticker (Order #, Phone, Date, Warranty)
      if (/Phone|טלפון|טל|Date|תאריך|Begin|Warranty|Customer\s*Order|Order\s*#|PO\s*#|הזמנה/i.test(line)) continue;

      // Normalize look-alike characters (O->0, I/l->1, S->5, etc.)
      const normalizedLine = normalizeDigits(line);

      // Check for standalone 7-10 digit numbers
      const numMatches = normalizedLine.match(/\b([0-9]{7,10})\b/g);
      if (numMatches) {
        for (const num of numMatches) {
          // Skip if matches serial number or Israeli phone prefix (05x, 09, 03, 08, 02) or year (19xx, 20xx)
          if (num === result.serialNumber) continue;
          if (/^(?:05\d{8}|0[23489]\d{7}|19\d{2}|20\d{2})$/.test(num)) continue;

          result.masha = num;
          break;
        }
        if (result.masha) break;
      }

      // Check for handwriting where digits might have spaces between them (e.g. "9 4 3 1 1 2 9 6 1")
      const spacedDigitsMatch = normalizedLine.match(/\b((?:[0-9]\s*){7,10})\b/);
      if (spacedDigitsMatch) {
        const compact = spacedDigitsMatch[1].replace(/\s+/g, '');
        if (compact.length >= 7 && compact.length <= 10 && compact !== result.serialNumber) {
          if (!/^(?:05\d{8}|0[23489]\d{7})$/.test(compact)) {
            result.masha = compact;
            break;
          }
        }
      }
    }
  }

  // Pass 4: Global text fallback for any 7-10 digit sequence (excluding phone / dates)
  if (!result.masha) {
    const allNormalized = normalizeDigits(rawText);
    const allDigitsMatches = allNormalized.match(/\b([0-9]{7,10})\b/g);
    if (allDigitsMatches) {
      for (const num of allDigitsMatches) {
        if (num === result.serialNumber) continue;
        if (/^(?:05\d{8}|0[23489]\d{7}|19\d{2}|20\d{2})$/.test(num)) continue;
        result.masha = num;
        break;
      }
    }
  }

  return result;
}