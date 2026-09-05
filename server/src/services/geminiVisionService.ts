import { VertexAI } from '@google-cloud/vertexai';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'shelv-ai';
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';

let vertexAIInstance: VertexAI | null = null;
let generativeModel: any = null;

function getGenerativeModel() {
  if (!generativeModel) {
    vertexAIInstance = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });
    generativeModel = vertexAIInstance.getGenerativeModel({
      model: process.env.VERTEX_MODEL || 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });
  }
  return generativeModel;
}

export interface GeminiSuspicions {
  mashaCandidate?: string | null;
  serialCandidate?: string | null;
  productCandidate?: string | null;
  ownerCandidate?: string | null;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  hint?: string;
}

export interface GeminiLabelInspectionResult {
  masha?: string;
  serialNumber?: string;
  productDescription?: string;
  stickerOwner?: string;
  rawText?: string;
  detected: boolean;
  suspicions?: GeminiSuspicions;
}

export async function analyzeFrameWithGemini(base64Image: string, targetMode: 'masha' | 'sn' | 'both' = 'both'): Promise<GeminiLabelInspectionResult> {
  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  const model = getGenerativeModel();

  const prompt = `
You are an expert OCR and inventory inspector scanning equipment labels and stickers in organizations (Israel / Ministry / Corporate).
Your task is to inspect the provided image of an IT equipment sticker/barcode and extract structured inventory metadata.
Currently, the scanner is specifically searching for: ${targetMode === 'sn' ? 'SERIAL NUMBER (S/N) of manufacturer/hardware' : targetMode === 'masha' ? 'MASHA (מסח"א / Catalog #)' : 'BOTH MASHA and SERIAL NUMBER'}.
Even if characters are partially blurry, cut off, or not 100% confirmed, provide your best hunch/suspicions in "suspicions".

Look specifically for:
1. "masha" (מסח"א / מספר קטלוגי / Catalog # / מק"ט):
   - A sequence of 7 to 10 digits (sometimes 6-12 digits).
   - Might follow "Catalog #", "Cat #", "מסח"א", "מק"ט", "מספר קטלוגי", or written directly in handwriting/label numbers.
   - Do NOT confuse it with phone numbers, dates, or order numbers.
2. "serialNumber" (S/N / Serial No. / Serial # / Serial Number / מס"ד / מספר סידורי / SN):
   - Manufacturer hardware serial number (e.g., HP/Lenovo/Dell format like 2UA..., PF..., 5CD..., CN..., or 1D/2D barcode alphanumeric value).
   - Often preceded by labels like "S/N", "Serial No.", "Serial No", "Serial #", "SN:", "מספר סידורי", "מס"ד", or directly next to a barcode.
3. "productDescription":
   - Hardware model / description visible on the label (e.g., "HP Elite Mini 800 G9", "Lenovo ThinkPad", "Dell OptiPlex", "מסך 24 אינץ'").
4. "stickerOwner" (בעל מצאי / אחראי):
   - Name of the employee / inventory holder if printed or handwritten on the sticker (in Hebrew or English).

Return JSON only in this exact format:
{
  "detected": true,
  "masha": "complete string digits or null if not yet 100% clear",
  "serialNumber": "complete string or null",
  "productDescription": "complete string or null",
  "stickerOwner": "string or null",
  "rawText": "brief summary of detected label text",
  "suspicions": {
    "mashaCandidate": "partial or tentative digits if spotted (e.g. '94312...' or '943121160') or null",
    "serialCandidate": "partial or tentative serial number or null",
    "productCandidate": "detected device or brand snippet or null",
    "ownerCandidate": "potential owner name or null",
    "confidence": "high" | "medium" | "low" | "none",
    "hint": "short Hebrew phrase for user, e.g. 'מזהה מספר סידורי, ייצב מצלמה' or 'מזהה ספרות מסח\"א, ייצב מצלמה' or 'כוון למדבקת יצרן S/N' or 'זוהתה מדבקת מחשב'"
  }
}

If no label/masha/serial is clearly visible or decipherable in this frame, return:
{
  "detected": false,
  "masha": null,
  "serialNumber": null,
  "productDescription": null,
  "stickerOwner": null,
  "rawText": "",
  "suspicions": {
    "mashaCandidate": null,
    "serialCandidate": null,
    "productCandidate": null,
    "ownerCandidate": null,
    "confidence": "none",
    "hint": "${targetMode === 'sn' ? 'כוון את המצלמה למדבקת היצרן או לברקוד S/N' : 'כוון את המצלמה ישירות למדבקה'}"
  }
}
`;

  const request = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  const response = await model.generateContent(request);
  const textResponse = response.response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    return { detected: false, rawText: '' };
  }

  try {
    const parsed = JSON.parse(textResponse);
    return {
      detected: Boolean(parsed.masha),
      masha: parsed.masha || undefined,
      serialNumber: parsed.serialNumber || undefined,
      productDescription: parsed.productDescription || undefined,
      stickerOwner: parsed.stickerOwner || undefined,
      rawText: parsed.rawText || '',
      suspicions: parsed.suspicions || undefined,
    };
  } catch (err) {
    console.error('[Gemini Vision] Failed to parse JSON response:', textResponse);
    return { detected: false, rawText: textResponse };
  }
}
