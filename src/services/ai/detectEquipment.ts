export type EquipmentImage = {
  // Absolute file path in server filesystem.
  filePath: string;
  // Public URL (e.g. "/uploads/<name>") - backend static serves it.
  url: string;
  // mime type, e.g. "image/jpeg"
  mimeType: string;
};

export type EquipmentAnalysisResult = {
  equipment: {
    name: string;
    confidence?: number;
  };
  muscles: string[];
  usage: {
    steps: string[];
    cues: string[];
    commonMistakes: string[];
  };
  tips: string[];
  images: Array<{
    url: string;
    caption?: string;
  }>;
};

type DetectEquipmentArgs = {
  image?: EquipmentImage;
  question?: string;
  language?: string;
  // Full previous structured turns (search results etc).
  history?: Array<Record<string, any>>;
};

export const detectEquipment = async (
  args: DetectEquipmentArgs,
): Promise<EquipmentAnalysisResult> => {
  const apiKey = process.env.GEMINI_API_KEY;
  const uploadedImageUrl = args.image?.url ?? null;
  const mock = (): EquipmentAnalysisResult => ({
    equipment: { name: 'Unknown equipment (mock)' },
    muscles: [],
    usage: { steps: [], cues: [], commonMistakes: [] },
    tips: [
      'AI provider is not available right now (quota/billing/key). This is a mock response.',
      'Enable Gemini API quota/billing, set GEMINI_API_KEY, then retry.',
    ],
    images: uploadedImageUrl
      ? [{ url: uploadedImageUrl, caption: 'Uploaded image' }]
      : [],
  });

  if (!apiKey) {
    // Allow backend CRUD/history to work without AI key.
    return mock();
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const imageModelName =
    process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';

  // New official JS SDK (Gemini Developer API)
  // https://github.com/googleapis/js-genai
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const history = Array.isArray(args.history) ? args.history : [];
  const language =
    typeof args.language === 'string' && args.language.trim()
      ? args.language.trim()
      : 'uz';

  const systemPrompt = [
    'You are a fitness expert and gym equipment identifier.',
    'Given an image of gym equipment (if provided) and optional user question, identify the equipment and provide detailed, practical guidance.',
    `Write ALL user-facing text in this language: ${language}.`,
    'Keep the JSON keys in English exactly as requested.',
    'Return ONLY valid JSON matching this schema:',
    '{',
    '  "equipment": { "name": string, "confidence"?: number },',
    '  "muscles": string[],',
    '  "usage": { "steps": string[], "cues": string[], "commonMistakes": string[] },',
    '  "tips": string[],',
    '  "images": { "url": string, "caption"?: string }[]',
    '}',
    'Do not include markdown. Do not include explanations outside JSON.',
  ].join('\n');

  const userPromptObj = {
    language,
    question: args.question ?? null,
    history,
    imageUrl: args.image?.url ?? null,
  };

  const parts: any[] = [
    { text: `${systemPrompt}\n\nINPUT:\n${JSON.stringify(userPromptObj)}` },
  ];

  if (args.image?.filePath) {
    const fs = await import('fs/promises');
    const buf = await fs.readFile(args.image.filePath);
    const b64 = buf.toString('base64');
    parts.push({
      inlineData: {
        mimeType: args.image.mimeType,
        data: b64,
      },
    });
  }

  let result: any;
  try {
    result = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts }],
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
      return mock();
    }
    if (msg.includes('404') && msg.includes('models/')) {
      throw new Error(
        [
          'Gemini model not found / not supported for generateContent.',
          `Tried model: ${modelName}`,
          'Fix: set GEMINI_MODEL in .env to an available model (example: gemini-2.5-flash).',
          'To list models for your key:',
          'curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"',
        ].join('\n'),
      );
    }
    throw e;
  }

  const text =
    typeof result?.text === 'string'
      ? result.text
      : typeof result?.response?.text === 'function'
        ? result.response.text()
        : typeof result?.response?.text === 'string'
          ? result.response.text
          : '';

  const parsed = safeJsonParse(text);
  const imageUrl = uploadedImageUrl;

  // Ensure required shape for structured output.
  const normalized: EquipmentAnalysisResult = {
    equipment: {
      name:
        typeof parsed?.equipment?.name === 'string'
          ? parsed.equipment.name
          : 'Unknown equipment',
      confidence:
        typeof parsed?.equipment?.confidence === 'number'
          ? parsed.equipment.confidence
          : undefined,
    },
    muscles: Array.isArray(parsed?.muscles)
      ? parsed.muscles.filter((m: any) => typeof m === 'string')
      : [],
    usage: {
      steps: Array.isArray(parsed?.usage?.steps)
        ? parsed.usage.steps.filter((s: any) => typeof s === 'string')
        : [],
      cues: Array.isArray(parsed?.usage?.cues)
        ? parsed.usage.cues.filter((s: any) => typeof s === 'string')
        : [],
      commonMistakes: Array.isArray(parsed?.usage?.commonMistakes)
        ? parsed.usage.commonMistakes.filter((s: any) => typeof s === 'string')
        : [],
    },
    tips: Array.isArray(parsed?.tips)
      ? parsed.tips.filter((t: any) => typeof t === 'string')
      : [],
    images: Array.isArray(parsed?.images)
      ? parsed.images
          .filter((img: any) => img && typeof img.url === 'string')
          .map((img: any) => ({
            url: img.url,
            caption: typeof img.caption === 'string' ? img.caption : undefined,
          }))
      : [],
  };

  // Always include uploaded image in response images.
  if (uploadedImageUrl) {
    normalized.images = [
      {
        url: uploadedImageUrl,
        caption: language.startsWith('ru')
          ? 'Загруженное изображение пользователя.'
          : language.startsWith('en')
            ? 'User uploaded image.'
            : 'Foydalanuvchi yuklagan rasm.',
      },
    ];
  } else {
    normalized.images = [];
  }

  // Optional: generate multiple educational mannequin illustrations.

  // ✅ TO'G'RI
  let imageBase64: string | undefined;
  if (args.image?.filePath) {
    const fs = await import('fs/promises');
    const buf = await fs.readFile(args.image.filePath);
    imageBase64 = buf.toString('base64');
  }

  const generatedImageUrls = await generateExerciseIllustrations({
    apiKey,
    modelName: imageModelName,
    language,
    equipmentName: normalized.equipment.name,
    muscles: normalized.muscles,
    imageBase64,
    imageMimeType: args.image?.mimeType,
  });
  for (let i = 0; i < generatedImageUrls.length; i++) {
    normalized.images.push({
      url: generatedImageUrls[i],
      caption: language.startsWith('ru')
        ? `Сгенерированная анатомическая иллюстрация #${i + 1}.`
        : language.startsWith('en')
          ? `Generated anatomical exercise illustration #${i + 1}.`
          : `Generatsiya qilingan anatomik mashq illyustratsiyasi #${i + 1}.`,
    });
  }

  return normalized;
};

type GenerateExerciseIllustrationArgs = {
  apiKey: string;
  modelName: string;
  language: string;
  equipmentName: string;
  muscles: string[];
  imageBase64?: string;
  imageMimeType?: string;
};

const generateExerciseIllustrations = async (
  args: GenerateExerciseIllustrationArgs,
): Promise<string[]> => {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: args.apiKey });

    const primaryMuscle = args.muscles[0] || 'Primary target muscle';
    const secondaryMuscles =
      args.muscles.length > 1
        ? args.muscles.slice(1, 4).join(', ')
        : 'Supporting muscles';
    const views = ['front', 'side', 'back'];
    const exerciseName = inferExerciseName(args.equipmentName);
    const urls: string[] = [];

    for (const view of views) {
      const prompt = [
        `Based on the gym equipment shown in the reference image,`,
        `create a detailed anatomical exercise illustration showing a person`,
        `performing ${exerciseName} on this exact equipment.`,
        `The figure is shown from ${view} view.`,
        `Muscles actively engaged are highlighted in RED:`,
        `- Primary: ${primaryMuscle}`,
        `- Secondary: ${secondaryMuscles}`,
        '',
        'Style: Clean white background, 3D rendered human muscle anatomy diagram,',
        'medical illustration style, no clothes, visible muscle groups,',
        'red highlights on active muscles, gray/light tone on inactive muscles.',
        'Similar to gym exercise anatomy charts.',
        'High quality, educational illustration.',
        `Output labels language: ${args.language}.`,
        'No logos, no watermarks.',
      ].join('\n');

      // ✅ Parts: rasm + text birga
      const contentParts: any[] = [];

      // Agar rasm bor bo'lsa — birinchi qo'sh
      if (args.imageBase64 && args.imageMimeType) {
        contentParts.push({
          inlineData: {
            mimeType: args.imageMimeType,
            data: args.imageBase64,
          },
        });
      }

      // Keyin text prompt
      contentParts.push({ text: prompt });

      const generated = await ai.models.generateContent({
        model: args.modelName,
        contents: [{ role: 'user', parts: contentParts }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'] as any,
        } as any,
      });

      console.log('=== GENERATED RESPONSE ===');
      console.log(JSON.stringify(generated, null, 2));

      const candidates =
        generated?.candidates || (generated as any)?.response?.candidates || [];
      console.log('=== CANDIDATES ===', JSON.stringify(candidates, null, 2));

      const imagePart = extractImagePart(generated);
      console.log(
        '=== IMAGE PART FOUND ===',
        imagePart ? 'YES, size: ' + imagePart.data?.length : 'NO',
      );
      if (!imagePart?.data) continue;

      const fs = await import('fs');
      const path = await import('path');
      const { v4 } = await import('uuid');

      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir))
        fs.mkdirSync(uploadsDir, { recursive: true });

      const ext = imagePart.mimeType?.includes('png') ? 'png' : 'jpg';
      const fileName = `${v4()}-generated-${view}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      const bytes = Uint8Array.from(Buffer.from(imagePart.data, 'base64'));
      fs.writeFileSync(filePath, bytes);
      urls.push(`/uploads/${fileName}`);
    }

    return urls;
  } catch (e) {
    console.error('generateExerciseIllustrations error:', e);
    return [];
  }
};

const inferExerciseName = (equipmentName: string): string => {
  const name = equipmentName.toLowerCase();
  if (
    name.includes('bike') ||
    name.includes('velosiped') ||
    name.includes('spin')
  ) {
    return 'indoor cycling';
  }
  if (name.includes('lat') || name.includes('pulldown')) {
    return 'lat pulldown';
  }
  if (name.includes('treadmill') || name.includes('yugur')) {
    return 'running/walking';
  }
  if (name.includes('row')) {
    return 'seated row';
  }
  return 'a representative exercise';
};

const extractImagePart = (
  generated: any,
): { data: string; mimeType?: string } | null => {
  // Try common SDK response shapes.
  const parts: any[] =
    generated?.candidates?.[0]?.content?.parts ||
    generated?.response?.candidates?.[0]?.content?.parts ||
    generated?.output?.[0]?.content?.parts ||
    [];

  for (const p of parts) {
    if (p?.inlineData?.data) {
      return { data: p.inlineData.data, mimeType: p.inlineData.mimeType };
    }
    if (p?.image?.data) {
      return { data: p.image.data, mimeType: p.image.mimeType };
    }
  }
  return null;
};

const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {}

  // Try extracting the first JSON object from mixed output
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const slice = text.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }

  return null;
};
