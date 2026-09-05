export interface ParsedItemData {
  masha?: string;
  serialNumber?: string;
  productDescription?: string;
  stickerOwner?: string;
}

export function parseLabelText(rawText: string): ParsedItemData {
  const result: ParsedItemData = {};
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // 1. Check for Catalog # / מסח"א
    const catalogMatch = line.match(/(?:Catalog\s*#|מס(?:ח"א|\s*קטלוגי)?)\s*[:#]?\s*([0-9]{7,12})/i);
    if (catalogMatch && !result.masha) {
      result.masha = catalogMatch[1];
    } else {
      const standaloneNum = line.match(/\b([0-9]{9})\b/);
      if (standaloneNum && !result.masha) {
        result.masha = standaloneNum[1];
      }
    }

    // 2. Check for Serial Number (S/N)
    const snMatch = line.match(/(?:Serial\s*(?:No\.?|#)?|S\/N|מספר סידורי)\s*[:#]?\s*([A-Z0-9]{8,14})/i);
    if (snMatch && !result.serialNumber) {
      result.serialNumber = snMatch[1].toUpperCase();
    } else {
      // OEM HP format: e.g., 2UA80920XS, 2UA4192N4X, 3CQ7290K11
      const hpSnMatch = line.match(/\b([0-9][A-Z]{2}[0-9]{5,7}[A-Z0-9]{1,3})\b/);
      if (hpSnMatch && !result.serialNumber) {
        result.serialNumber = hpSnMatch[1].toUpperCase();
      }
    }

    // 3. Product Description (HP EliteDesk, Lenovo, etc.)
    const descMatch = line.match(/(?:Description\s*[:#]?\s*)(.+)/i);
    if (descMatch && !result.productDescription) {
      result.productDescription = descMatch[1].trim();
    } else if (/HP Elite|HP Pro|Lenovo ThinkPad|Dell UltraSharp|HP LaserJet/i.test(line) && !result.productDescription) {
      result.productDescription = line;
    }

    // 4. Hebrew Sticker Owner (בעל מצאי)
    const ownerMatch = line.match(/(?:בעל\s*מצאי|בעלים)\s*[:#]?\s*([א-ת\s"״]+)/);
    if (ownerMatch && !result.stickerOwner) {
      result.stickerOwner = ownerMatch[1].trim();
    }
  }

  return result;
}