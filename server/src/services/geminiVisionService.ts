import { VertexAI } from '@google-cloud/vertexai';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'shelv-ai';
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';

let vertexAIInstance: VertexAI | null = null;
let generativeModel: any = null;
let fastQualifyModel: any = null;

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

function getFastQualifyModel() {
  if (!fastQualifyModel) {
    if (!vertexAIInstance) {
      vertexAIInstance = new VertexAI({
        project: PROJECT_ID,
        location: LOCATION,
      });
    }
    // gemini-2.5-flash with maxOutputTokens 120 for lightning-fast qualification check
    fastQualifyModel = vertexAIInstance.getGenerativeModel({
      model: process.env.VERTEX_FAST_MODEL || process.env.VERTEX_MODEL || 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.0,
        maxOutputTokens: 120,
      },
    });
  }
  return fastQualifyModel;
}

export interface GeminiSuspicions {
  mashaCandidate?: string | null;
  serialCandidate?: string | null;
  productCandidate?: string | null;
  ownerCandidate?: string | null;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  hint?: string;
  box_2d?: [number, number, number, number] | null; // [ymin, xmin, ymax, xmax] 0..1000
}

export interface GeminiFrameQualification {
  isRelevant: boolean;
  probability: 'high' | 'medium' | 'low';
  elementType?: 'masha_label' | 'serial_label' | 'barcode' | 'equipment_label' | 'none';
  hint: string;
  box_2d?: [number, number, number, number] | null; // [ymin, xmin, ymax, xmax] 0..1000
}

export async function qualifyFrameWithGemini(
  base64Image: string,
  targetMode: 'masha' | 'sn' | 'both' = 'both'
): Promise<GeminiFrameQualification> {
  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  const model = getFastQualifyModel();

  const prompt = `
Task: Extremely rapid visual triage.
Determine in <0.2s if this camera image contains a clear, in-focus IT asset sticker, barcode, or serial plate relevant to: ${targetMode}.
Is it close enough, oriented, and focused with HIGH probability that OCR/deciphering will succeed?
If an asset label or barcode is visible, provide its approximate 2D bounding box in normalized [ymin, xmin, ymax, xmax] scaled 0 to 1000.

Return JSON ONLY:
{
  "isRelevant": true/false,
  "probability": "high" | "medium" | "low",
  "elementType": "masha_label" | "serial_label" | "barcode" | "equipment_label" | "none",
  "hint": "short Hebrew advice max 4 words (e.g. 'קרב מצלמה', 'מדבקה זוהתה! ייצב', 'תמונה מטושטשת')",
  "box_2d": [ymin, xmin, ymax, xmax] or null
}
`;

  try {
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
      return { isRelevant: false, probability: 'low', elementType: 'none', hint: 'כוון למדבקה', box_2d: null };
    }

    const parsed = JSON.parse(textResponse);
    return {
      isRelevant: Boolean(parsed.isRelevant),
      probability: parsed.probability || (parsed.isRelevant ? 'high' : 'low'),
      elementType: parsed.elementType || 'none',
      hint: parsed.hint || (parsed.isRelevant ? 'מדבקה זוהתה' : 'כוון למדבקה'),
      box_2d: Array.isArray(parsed.box_2d) && parsed.box_2d.length === 4 ? parsed.box_2d : null,
    };
  } catch (err: any) {
    console.warn('[Gemini Fast Qualify] Fallback:', err.message);
    return { isRelevant: false, probability: 'low', elementType: 'none', hint: 'כוון למדבקה', box_2d: null };
  }
}

export interface GeminiLabelInspectionResult {
  masha?: string;
  serialNumber?: string;
  productDescription?: string;
  stickerOwner?: string;
  rawText?: string;
  detected: boolean;
  errorMessage?: string;
  box_2d?: [number, number, number, number] | null;
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

If you spot the target label, barcode, or key text, return its bounding box "box_2d" as [ymin, xmin, ymax, xmax] normalized on a 0 to 1000 scale (where 0 is top/left, 1000 is bottom/right).

Look specifically for:
1. "masha" (מסח"א / מספר קטלוגי / Catalog # / מק"ט):
   - A sequence of 7 to 10 digits (sometimes 6-12 digits).
   - Might follow "Catalog #", "Cat #", "מסח"א", "מק"ט", "מספר קטלוגי", or written directly in handwriting/label numbers.
   - Do NOT confuse it with phone numbers, dates, or order numbers.
2. "serialNumber" (S/N / Serial No. / Serial No / Serial # / SN: / מספר סידורי / מס"ד / SN):
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
  "errorMessage": null,
  "box_2d": [ymin, xmin, ymax, xmax],
  "suspicions": {
    "mashaCandidate": "partial or tentative digits if spotted (e.g. '94312...' or '943121160') or null",
    "serialCandidate": "partial or tentative serial number or null",
    "productCandidate": "detected device or brand snippet or null",
    "ownerCandidate": "potential owner name or null",
    "confidence": "high" | "medium" | "low" | "none",
    "hint": "short Hebrew phrase for user, e.g. 'מזהה מספר סידורי, ייצב מצלמה' or 'מזהה ספרות מסח\"א, ייצב מצלמה' or 'כוון למדבקת יצרן S/N' or 'זוהתה מדבקת מחשב'",
    "box_2d": [ymin, xmin, ymax, xmax]
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
  "errorMessage": "${targetMode === 'sn' ? 'לא זוהה מספר סידורי (S/N) בתמונה. ודא שמדבקת היצרן ברורה ומוארת ונסה שוב.' : 'לא זוהה מספר מסח\"א בתמונה. ודא שמדבקת המסח\"א (Catalog #) מוארת, בפוקוס וממלאת את המסגרת, ונסה שוב.'}",
  "box_2d": null,
  "suspicions": {
    "mashaCandidate": null,
    "serialCandidate": null,
    "productCandidate": null,
    "ownerCandidate": null,
    "confidence": "none",
    "hint": "${targetMode === 'sn' ? 'כוון את המצלמה למדבקת היצרן או לברקוד S/N' : 'כוון את המצלמה ישירות למדבקה'}",
    "box_2d": null
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
    return {
      detected: false,
      rawText: '',
      box_2d: null,
      errorMessage: targetMode === 'sn' ? 'לא התקבלה תשובה מ-Gemini עבור S/N' : 'לא זוהה מסח"א בתמונה'
    };
  }

  try {
    const parsed = JSON.parse(textResponse);
    const box2d = Array.isArray(parsed.box_2d) && parsed.box_2d.length === 4
      ? parsed.box_2d
      : (Array.isArray(parsed.suspicions?.box_2d) && parsed.suspicions.box_2d.length === 4 ? parsed.suspicions.box_2d : null);

    const isDetected = Boolean(parsed.masha || parsed.serialNumber);

    let errMsg = parsed.errorMessage;
    if (!isDetected && !errMsg) {
      errMsg = targetMode === 'sn'
        ? 'לא אותר מספר סידורי (S/N) בתמונה. נסה לצלם שוב בזווית ישרה ובתאורה טובה.'
        : 'לא אותר מספר מסח"א (Catalog #) בתמונה. יש לקרב את המצלמה למדבקה ולצלם שוב.';
    }

    return {
      detected: isDetected,
      masha: parsed.masha || undefined,
      serialNumber: parsed.serialNumber || undefined,
      productDescription: parsed.productDescription || undefined,
      stickerOwner: parsed.stickerOwner || undefined,
      rawText: parsed.rawText || '',
      errorMessage: !isDetected ? errMsg : undefined,
      box_2d: box2d,
      suspicions: parsed.suspicions ? { ...parsed.suspicions, box_2d: parsed.suspicions.box_2d || box2d } : undefined,
    };
  } catch (err) {
    console.error('[Gemini Vision] Failed to parse JSON response:', textResponse);
    return {
      detected: false,
      rawText: textResponse,
      box_2d: null,
      errorMessage: targetMode === 'sn' ? 'שגיאה בפענוח נתוני S/N' : 'לא זוהה מסח"א ברור בתמונה'
    };
  }
}
