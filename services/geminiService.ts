
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum retry attempts for transient API errors. */
const MAX_RETRIES = 2;

/** Base delay (ms) for exponential back-off between retries. */
const BASE_DELAY_MS = 1_000;

/** Model used for image generation. */
const MODEL = "gemini-3-pro-image-preview";

// ---------------------------------------------------------------------------
// API key & client bootstrap
// ---------------------------------------------------------------------------

// Vite exposes env vars as import.meta.env; keep a fallback for node-style envs in case of SSR/tests.
const apiKey =
  (typeof import.meta !== "undefined"
    ? import.meta.env?.VITE_GEMINI_API_KEY
    : undefined) ||
  (typeof process !== "undefined"
    ? process.env?.GEMINI_API_KEY
    : undefined);

if (!apiKey) {
  console.warn(
    "Gemini API key not set; generation will fail until configured.",
  );
}

let ai: GoogleGenAI | null = apiKey ? new GoogleGenAI({ apiKey }) : null;

const assertClient = (): GoogleGenAI => {
  if (!apiKey) {
    throw new Error(
      "Gemini API key missing. Set VITE_GEMINI_API_KEY before generating.",
    );
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Sanitise and validate the vocabulary item before it reaches the prompt.
 * Trims whitespace, rejects empty / excessively long strings, and strips
 * characters that could confuse the model or break prompt structure.
 */
const sanitizeItem = (raw: string): string => {
  const trimmed = raw.trim().replace(/\s+/g, " ");

  if (trimmed.length === 0) {
    throw new Error("Item cannot be empty.");
  }
  if (trimmed.length > 60) {
    throw new Error(
      `Item "${trimmed.slice(0, 20)}…" is too long (max 60 chars).`,
    );
  }

  // Strip anything that is not a letter, number, space, or common punctuation.
  const cleaned = trimmed.replace(/[^\p{L}\p{N}\s\-']/gu, "");
  if (cleaned.length === 0) {
    throw new Error(`Item "${trimmed}" contains no usable characters.`);
  }

  return cleaned;
};

// ---------------------------------------------------------------------------
// Response extraction
// ---------------------------------------------------------------------------

export const extractInlineImageData = (
  response: GenerateContentResponse,
  item: string,
): string => {
  const candidates = response.candidates ?? [];

  if (candidates.length === 0) {
    throw new Error(
      `Gemini returned no candidates for "${item}". The request may have been blocked by safety filters.`,
    );
  }

  const parts = candidates[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  // If there is text instead of an image, log it for debugging.
  const textParts = parts.filter((p) => p.text).map((p) => p.text);
  if (textParts.length > 0) {
    console.warn(
      `Gemini returned text instead of an image for "${item}":`,
      textParts.join("\n"),
    );
  }

  throw new Error(`No image data found in response for item: "${item}".`);
};

// ---------------------------------------------------------------------------
// Prompt engineering
// ---------------------------------------------------------------------------

const createPrompt = (item: string): string => {
  const label = item.toUpperCase();

  return `
# ROLE
You are a senior children's-book illustrator who specialises in bold, clean, black-and-white line-art vocabulary flashcards for pre-school learners (ages 3–6).

# OBJECTIVE
Generate **one** print-ready vocabulary flashcard image for the item: **"${item}"**.

---

## CARD SPECIFICATIONS

### Dimensions & Layout
| Zone | Proportion | Content |
|------|-----------|---------|
| Outer card | 3 : 4 portrait ratio | Solid black rounded-corner border (≈ 3 % of card width) on a pure-white background. |
| Illustration area | Top 75 % of the inner card | Centred, bold line-art drawing of "${item}". |
| Divider | — | A single, solid black horizontal line spanning the full inner width, separating the two areas. |
| Label area | Bottom 25 % of the inner card | The word **"${label}"** centred in **Montserrat Extra-Bold (800 weight)** typeface. |

### Illustration Guidelines
- **Style**: Flat-vector, bold black outlines only (uniform stroke weight ≈ 2–3 pt equivalent). All enclosed areas filled with pure white.
- **Recognisability**: The drawing must be instantly identifiable by a 5-year-old child. Prefer the most iconic, canonical view of "${item}" (e.g. an apple shown from the side with a stem and leaf).
- **Simplicity**: Use the fewest lines necessary while remaining unambiguous. No cross-hatching, stippling, or decorative flourishes.
- **Centering**: The illustration must be visually centred (optically balanced) with comfortable padding from the border.

### Typography Guidelines — Font: Montserrat Extra-Bold 800
- The label text is **"${label}"** — reproduce these exact characters.
- **Font**: Use **exactly Montserrat Extra-Bold (weight 800)**, a geometric sans-serif typeface. Do NOT substitute any other font. The letterforms must match Montserrat's characteristic geometric, rounded, and evenly-weighted glyphs.
- Key Montserrat traits to reproduce: perfectly circular "O", flat-top "A" without serif, square-shouldered "E" and "F", single-storey "a" at display sizes, wide and open letter proportions.
- The text must be horizontally and vertically centred within the label area.
- Letter-spacing should be slightly expanded (~5 % tracking) for readability.
- Text colour is pure black (#000000) on white background — no outline, no shadow, no effects on the text.

---

## STRICT CONSTRAINTS — MUST FOLLOW
1. **Pure black (#000000) and pure white (#FFFFFF) ONLY.** Zero greys, zero colours, zero gradients, zero transparency.
2. **No shading, shadows, textures, halftones, or 3D effects.**
3. **No extra text, captions, logos, or watermarks** — only the item name in the label area.
4. **No background scenery or secondary objects** — the card interior is pure white except for the illustration and label.
5. **Maintain consistent stroke weight** throughout the entire illustration.
6. **The card must stand alone** — do not render a table, hand, or any object holding the card.
7. **Font must be Montserrat Extra-Bold 800** — do not use any other typeface for the label.

---

## QUALITY CHECKLIST (verify before outputting)
- [ ] Card has a visible rounded-border frame.
- [ ] There is a clear horizontal divider between illustration and label.
- [ ] The illustration is centred and recognisable.
- [ ] The label reads exactly "${label}".
- [ ] The label uses Montserrat Extra-Bold 800 letterforms (geometric, even weight, wide proportions).
- [ ] The entire image is strictly black-and-white with no greys.
- [ ] No extraneous elements exist on or around the card.
`.trim();
};

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Determine whether an error is likely transient (network hiccup, rate-limit,
 * server 5xx) and therefore worth retrying.
 */
const isRetryable = (err: unknown): boolean => {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("503") ||
      msg.includes("rate") ||
      msg.includes("unavailable") ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("fetch failed")
    );
  }
  return false;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const generateFlashcard = async (item: string): Promise<string> => {
  const sanitized = sanitizeItem(item);
  const prompt = createPrompt(sanitized);
  const client = assertClient();

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: { parts: [{ text: prompt }] },
        config: {
          temperature: 0.3, // low creativity → more consistent output
        },
      });

      return extractInlineImageData(response, sanitized);
    } catch (error) {
      lastError = error;

      const retriesLeft = MAX_RETRIES - attempt;
      if (retriesLeft > 0 && isRetryable(error)) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        console.warn(
          `Retryable error for "${sanitized}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
          `Retrying in ${delay} ms…`,
          error,
        );
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  // All attempts exhausted — throw a descriptive error.
  console.error(
    `Error generating flashcard for "${sanitized}" after ${MAX_RETRIES + 1} attempt(s):`,
    lastError,
  );
  throw new Error(
    `Failed to generate flashcard for "${sanitized}". ${lastError instanceof Error ? lastError.message : ""}`.trim(),
  );
};
