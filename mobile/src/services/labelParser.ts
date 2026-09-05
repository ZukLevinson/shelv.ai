export interface ParsedItemData {
  masha?: string;
  serialNumber?: string;
  productDescription?: string;
  stickerOwner?: string;
}

export function parseLabelText(rawText: string): ParsedItemData {
  const result: ParsedItemData = {};
  if (!rawText) return result;

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Clean common OCR noise like pipes, brackets, leading colons
    const cleanLine = line.replace(/[|\[\]{}~_]/g, ' ').trim();

    // 1. Check for Catalog # / מסח"א / מס קטלוגי
    const catalogMatch = cleanLine.match(/(?:Catalog\s*#?|מס(?:ח"א|\s*קטלוגי|\s*מצאי)?)\s*[:#\-.]?\s*([0-9]{7,12})/i);
    if (catalogMatch && !result.masha) {
      result.masha = catalogMatch[1];
    } else {
      // Standalone 8 to 10 digit number (standard IDF/Government Masha length)
      const standaloneNum = cleanLine.match(/\b([0-9]{8,10})\b/);
      if (standaloneNum && !result.masha) {
        result.masha = standaloneNum[1];
      }
    }

    // 2. Check for Serial Number (S/N)
    const snMatch = cleanLine.match(/(?:Serial\s*(?:No\.?|#)?|S\/N|מספר סידורי|מס"ד|סריאלי)\s*[:#\-.]?\s*([A-Z0-9]{7,16})/i);
    if (snMatch && !result.serialNumber) {
      result.serialNumber = snMatch[1].toUpperCase();
    } else {
      // OEM HP/Lenovo format: e.g., 2UA80920XS, 2UA4192N4X, 3CQ7290K11, PF3XYZ12
      const hpSnMatch = cleanLine.match(/\b([0-9][A-Z]{2}[0-9]{5,7}[A-Z0-9]{1,3})\b/i);
      if (hpSnMatch && !result.serialNumber) {
        result.serialNumber = hpSnMatch[1].toUpperCase();
      }
    }

    // 3. Product Description (HP EliteDesk, Lenovo, etc.)
    const descMatch = cleanLine.match(/(?:Description|תיאור)\s*[:#\-.]?\s*(.+)/i);
    if (descMatch && !result.productDescription) {
      result.productDescription = descMatch[1].trim();
    } else if (/HP Elite|HP Pro|Lenovo ThinkPad|Dell UltraSharp|HP LaserJet|Dell OptiPlex/i.test(cleanLine) && !result.productDescription) {
      result.productDescription = cleanLine;
    }

    // 4. Hebrew Sticker Owner (בעל מצאי)
    const ownerMatch = cleanLine.match(/(?:בעל\s*מצאי|בעלים|אחראי|שם)\s*[:#\-.]?\s*([א-ת\s"״]+)/);
    if (ownerMatch && !result.stickerOwner) {
      result.stickerOwner = ownerMatch[1].trim();
    }
  }

  // Fallback: If no explicit masha found in lines, search entire raw text for any 8-10 digit sequence
  if (!result.masha) {
    const rawMatch = rawText.match(/\b([0-9]{8,10})\b/);
    if (rawMatch) {
      result.masha = rawMatch[1];
    }
  }

  return result;
}