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
  // The user explicitly specified:
  // "if there is white label with Catalog # - do not scan the barcode. no barcodes should be scanned at all. only the numbers after the Catalog #: ..."
  const catalogRegex = /(?:Catalog\s*(?:#|No\.?|Num\.?|Number)?|Cat\s*#?|מס(?:ח"?א|\s*קטלוגי|\s*מצאי|\s*סידורי\s*של)?|מק"?ט)\s*[:#\-.\s]+([0-9A-Za-z\s\-]{6,16})/i;

  for (const line of lines) {
    const cleanLine = line.replace(/[|\[\]{}~_]/g, ' ').trim();

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
    const multilineMatch = rawText.match(/(?:Catalog\s*(?:#|No\.?|Num\.?|Number)?|Cat\s*#?|מס(?:ח"?א|\s*קטלוגי|\s*מצאי)?|מק"?ט)[\s:#\-.\n]+([0-9A-Za-z\s]{6,16})/i);
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

    // S/N matching
    const snMatch = cleanLine.match(/(?:Serial\s*(?:No\.?|#)?|S\/N|מספר סידורי|מס"ד|סריאלי)\s*[:#\-.]?\s*([A-Z0-9]{6,18})/i);
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

  // Pass 3: Handwritten Masha fallback (standalone 7 to 10 digit sequence)
  if (!result.masha) {
    for (const line of lines) {
      const cleanLine = line.replace(/[^\w\s]/g, ' ').trim();
      const numMatch = cleanLine.match(/\b([0-9]{7,10})\b/);
      if (numMatch && numMatch[1] !== result.serialNumber) {
        result.masha = numMatch[1];
        break;
      }
    }
  }

  // Pass 4: Raw text fallback for any 8-10 digit sequence
  if (!result.masha) {
    const rawDigits = rawText.match(/\b([0-9]{8,10})\b/);
    if (rawDigits && rawDigits[1] !== result.serialNumber) {
      result.masha = rawDigits[1];
    }
  }

  return result;
}