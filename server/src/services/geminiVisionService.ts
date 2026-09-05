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
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });
  }
  return generativeModel;
}

export interface GeminiLabelInspectionResult {
  masha?: string;
  serialNumber?: string;
  productDescription?: string;
  stickerOwner?: string;
  rawText?: string;
  detected: boolean;
}

export async function analyzeFrameWithGemini(base64Image: string): Promise<GeminiLabelInspectionResult> {
  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  const model = getGenerativeModel();

  const prompt = `
You are an expert OCR and inventory inspector scanning equipment labels and stickers in organizations (Israel / Ministry / Corporate).
Your task is to inspect the provided image of an IT equipment sticker/barcode and extract structured inventory metadata.

Look specifically for:
1. "masha" (מסח"א / מספר קטלוגי / Catalog # / מק"ט):
   - A sequence of 7 to 10 digits (sometimes 6-12 digits).
   - Might follow "Catalog #", "Cat #", "מסח"א", "מק"ט", "מספר קטלוגי", or written directly in handwriting/label numbers.
   - Do NOT confuse it with phone numbers, dates, or order numbers.
2. "serialNumber" (S/N / מס"ד / Serial Number):
   - Manufacturer hardware serial number (e.g., HP/Lenovo format like 2UA..., PF..., 5CD..., or alphanumeric barcode value).
3. "productDescription":
   - Hardware model / description visible on the label (e.g., "HP Elite Mini 800 G9", "Lenovo ThinkPad", "Dell OptiPlex", "מסך 24 אינץ'").
4. "stickerOwner" (בעל מצאי / אחראי):
   - Name of the employee / inventory holder if printed or handwritten on the sticker (in Hebrew or English).

Return JSON only in this exact format:
{
  "detected": true,
  "masha": "string digits or null",
  "serialNumber": "string or null",
  "productDescription": "string or null",
  "stickerOwner": "string or null",
  "rawText": "brief summary of detected label text"
}

If no label/masha/serial is clearly visible or decipherable in this frame, return:
{
  "detected": false,
  "masha": null,
  "serialNumber": null,
  "productDescription": null,
  "stickerOwner": null,
  "rawText": ""
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
      detected: Boolean(parsed.masha || parsed.serialNumber),
      masha: parsed.masha || undefined,
      serialNumber: parsed.serialNumber || undefined,
      productDescription: parsed.productDescription || undefined,
      stickerOwner: parsed.stickerOwner || undefined,
      rawText: parsed.rawText || '',
    };
  } catch (err) {
    console.error('[Gemini Vision] Failed to parse JSON response:', textResponse);
    return { detected: false, rawText: textResponse };
  }
}
