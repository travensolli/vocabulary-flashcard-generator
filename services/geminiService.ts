import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// Logic Migrated from Server (for Pure Frontend Deployment)
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1_000;
const FALLBACK_MODEL = "gemini-2.0-flash-exp";

const sanitizeItem = (raw: string): string => {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) throw new Error("Item cannot be empty.");
  if (trimmed.length > 60) throw new Error(`Item "${trimmed.slice(0, 20)}…" is too long.`);

  const cleaned = trimmed.replace(/[^\p{L}\p{N}\s\-']/gu, "");
  if (cleaned.length === 0) throw new Error(`Item "${trimmed}" contains no usable characters.`);

  return cleaned;
};

const getRealismStyle = (level: number): { label: string; illustration: string } => {
  const clamped = Math.max(1, Math.min(5, Math.round(level)));
  const styles: Record<number, { label: string; illustration: string }> = {
    1: {
      label: 'Simplified Cartoon',
      illustration: 'Use an extremely simplified cartoon style with basic geometric shapes, minimal details, and a playful clip-art aesthetic. Think simple stick-figure-level shapes with bold, exaggerated proportions. No fine details whatsoever.',
    },
    2: {
      label: 'Stylized Children\'s Illustration',
      illustration: 'Use a friendly, stylized children\'s book illustration style with soft rounded shapes, slightly exaggerated proportions, and gentle curves. The drawing should feel warm and approachable, like a hand-drawn storybook illustration.',
    },
    3: {
      label: 'Standard Illustration',
      illustration: 'Use a clean, standard children\'s educational illustration style with clear recognisable forms, balanced proportions, and moderate detail. This is the classic flashcard look — clear, tidy, and easy to identify.',
    },
    4: {
      label: 'Detailed Semi-Realistic',
      illustration: 'Use a detailed semi-realistic illustration style with accurate natural proportions, subtle shading hints, and fine line work. The drawing should look like a high-quality educational textbook illustration with realistic anatomy and structure, while still being a drawing rather than a photograph.',
    },
    5: {
      label: 'Photorealistic',
      illustration: 'Create a hyper-realistic, photographic-quality rendering of the subject. It should look like a professional studio photograph with accurate lighting, textures, materials, and depth of field. Aim for maximum visual fidelity as if captured by a high-end camera.',
    },
  };
  return styles[clamped];
};

const extractInlineImageData = (response: any, item: string): string => {
  const candidates = response.candidates ?? [];
  if (candidates.length === 0) throw new Error(`No candidates for "${item}".`);
  const parts = candidates[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error(`No image data found for: "${item}".`);
};

const getIllustrationGuidelines = (item: string, realism: number, isColored: boolean): string => {
  const r = Math.max(1, Math.min(5, Math.round(realism)));
  if (!isColored) {
    const bwStyles: Record<number, string> = {
      1: `- **Style**: Extremely simplified cartoon. Use basic geometric shapes to represent "${item}". Think clip-art simplicity. Bold black outlines only, all fills pure white.`,
      2: `- **Style**: Stylized children's book illustration. Soft, rounded shapes. Bold black outlines, all fills pure white.`,
      3: `- **Style**: Clean, standard educational flashcard illustration. Flat-vector look with bold black outlines. All enclosed areas filled with pure white.`,
      4: `- **Style**: Detailed semi-realistic black-and-white illustration. Include **cross-hatching or stippling for shading and volume**.`,
      5: `- **Style**: Hyper-realistic photographic-quality black-and-white rendering. Full greyscale tonal range is required.`,
    };
    return bwStyles[r];
  } else {
    const colorStyles: Record<number, string> = {
      1: `- **Style**: Extremely simplified cartoon with bold colours. Bold black outlines with large flat fills of bright primary colours.`,
      2: `- **Style**: Friendly, stylized children's book illustration with vibrant colours. Bold black outlines, filled with cheerful flat colours.`,
      3: `- **Style**: Clean, standard educational flashcard illustration with vibrant, child-friendly colours. Flat-vector with bold black outlines.`,
      4: `- **Style**: Detailed semi-realistic colour illustration. Include **subtle shading and gradient fills** for depth and volume.`,
      5: `- **Style**: Hyper-realistic, photographic-quality full-colour rendering. Realistic lighting, reflections, textures, and depth of field.`,
    };
    return colorStyles[r];
  }
};

const getConstraints = (realism: number, isColored: boolean): string => {
  const r = Math.max(1, Math.min(5, Math.round(realism)));
  const common = [
    '**No extra text, captions, logos, or watermarks** — only the item name in the label area.',
    '**No background scenery or secondary objects**.',
    '**The card must stand alone** — do not render a table, hand, or anything holding the card.',
    '**Font must be Montserrat Extra-Bold 800**.',
  ];

  let specific: string[] = [];
  if (!isColored) {
    if (r <= 3) {
      specific = ['**Pure black and pure white ONLY.** Zero greys, zero colours.', '**No shading, shadows, textures.**'];
    } else if (r === 4) {
      specific = ['**Black and white only** — grey tones through cross-hatching/stippling allowed.', '**No colours.**'];
    } else {
      specific = ['**Full greyscale range allowed** — smooth gradients and soft shadows.', '**No colours.**'];
    }
  } else {
    if (r <= 3) {
      specific = ['**Use flat, vibrant colours.** No gradients, no textures.', '**Bold black outlines**.', '**No shading or shadows.**'];
    } else if (r === 4) {
      specific = ['**Naturalistic colours with subtle shading.** Soft gradients allowed.', '**Include light and shadow** for depth.'];
    } else {
      specific = ['**Full photorealistic colour rendering required.**', '**No outlines**.', '**Realistic lighting, shadows, reflections.**'];
    }
  }
  return [...specific, ...common].map((c, i) => `${i + 1}. ${c}`).join('\n');
};

const getChecklist = (realism: number, isColored: boolean): string => {
  const r = Math.max(1, Math.min(5, Math.round(realism)));
  const base = [
    'Card has a visible rounded-border frame.',
    'There is a clear horizontal divider between illustration and label.',
    'The illustration is centred and recognisable.',
  ];
  if (!isColored) {
    if (r <= 3) base.push('Strictly black-and-white with no greys.');
    else if (r === 4) base.push('Uses cross-hatching or stippling for shading.');
    else base.push('Photographic-quality greyscale rendering.');
  } else {
    if (r <= 3) base.push('Colours are bright, flat — no gradients.');
    else if (r === 4) base.push('Naturalistic with subtle shading.');
    else base.push('Photorealistic colour rendering.');
  }
  return base.map(c => `- [ ] ${c}`).join('\n');
};

const createFlashcardPrompt = (item: string, realism: number, isColored: boolean): string => {
  const label = item.toUpperCase();
  const style = getRealismStyle(realism);
  let illustrationDesc = realism <= 3 ? (isColored ? "full-colour drawing" : "line-art drawing") :
    realism === 4 ? (isColored ? "detailed colour illustration" : "detailed illustration") :
      (isColored ? "photorealistic colour rendering" : "photorealistic rendering");

  const roleName = isColored ? "vibrant, full-colour" : "black-and-white";

  return `
# ROLE
You are a senior illustrator specialising in ${roleName} vocabulary flashcards.

# TARGET REALISM LEVEL: ${style.label} (${realism}/5)
**THIS IS THE MOST IMPORTANT INSTRUCTION.** ${style.illustration}

# OBJECTIVE
Generate **one** vocabulary flashcard image for the item: **"${item}"**.

## CARD SPECIFICATIONS
- **Outer card**: 3:4 portrait ratio, solid black rounded border on white.
- **Illustration area**: Top 75%, centred ${illustrationDesc}.
- **Divider**: Solid black horizontal line.
- **Label area**: Bottom 25%, text "${label}" in Montserrat Extra-Bold (800).

### Guidelines
${getIllustrationGuidelines(item, realism, isColored)}

### Typography
- Font: Montserrat Extra-Bold 800.
- Text: "${label}".

## STRICT CONSTRAINTS
${getConstraints(realism, isColored)}

## QUALITY CHECKLIST
${getChecklist(realism, isColored)}
`.trim();
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isRetryable = (err: any): boolean => {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("429") || msg.includes("500") || msg.includes("503") || msg.includes("rate") || msg.includes("unavailable");
};

// ---------------------------------------------------------------------------
// Client API Service
// ---------------------------------------------------------------------------

export const generateFlashcard = async (
  item: string,
  isColored: boolean = false,
  realism: number = 3,
  apiKey?: string,
  model?: string
): Promise<string> => {
  if (!apiKey) throw new Error("API key is required.");

  // Use the exact same initialization sequence as the previously working server
  const genAI = new GoogleGenAI({ apiKey });
  const effectiveModel = model || "gemini-2.5-flash-image"; // Reverting to server's default
  const sanitized = sanitizeItem(item);
  const prompt = createFlashcardPrompt(sanitized, realism, isColored);

  let lastError: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await genAI.models.generateContent({
        model: effectiveModel,
        contents: prompt,
        config: {
          temperature: 0.3,
        }
      });

      return extractInlineImageData(response, sanitized);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed for "${item}":`, error);
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        await sleep(BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      break;
    }
  }

  throw new Error(lastError?.message || "Failed to generate image.");
};
