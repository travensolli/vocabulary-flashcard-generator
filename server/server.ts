import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { DEFAULT_MAX_ITEMS } from '../utils/items.js';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Gemini Service Logic Migrated to Server
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1_000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.warn("Gemini API key not set on server; generation will fail until configured.");
}

let ai: GoogleGenAI | null = apiKey ? new GoogleGenAI({ apiKey }) : null;

const assertClient = (): GoogleGenAI => {
    if (!apiKey) {
        throw new Error("Gemini API key missing on server.");
    }
    if (!ai) {
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

const sanitizeItem = (raw: string): string => {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (trimmed.length === 0) throw new Error("Item cannot be empty.");
    if (trimmed.length > 60) throw new Error(`Item "${trimmed.slice(0, 20)}…" is too long.`);

    const cleaned = trimmed.replace(/[^\p{L}\p{N}\s\-']/gu, "");
    if (cleaned.length === 0) throw new Error(`Item "${trimmed}" contains no usable characters.`);

    return cleaned;
};

const extractInlineImageData = (response: GenerateContentResponse, item: string): string => {
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

const createColorPrompt = (item: string): string => {
    const label = item.toUpperCase();
    return `
# ROLE
You are a senior children's-book illustrator who specialises in bold, vibrant, full-colour vocabulary flashcards for pre-school learners (ages 3–6).

# OBJECTIVE
Generate **one** print-ready vocabulary flashcard image for the item: **"${item}"**.

---

## CARD SPECIFICATIONS

### Dimensions & Layout
| Zone | Proportion | Content |
|------|-----------|---------|
| Outer card | 3 : 4 portrait ratio | Solid black rounded-corner border (≈ 3 % of card width) on a pure-white background. |
| Illustration area | Top 75 % of the inner card | Centred, bold, full-colour drawing of "${item}". |
| Divider | — | A single, solid black horizontal line spanning the full inner width, separating the two areas. |
| Label area | Bottom 25 % of the inner card | The word **"${label}"** centred in **Montserrat Extra-Bold (800 weight)** typeface. |

### Illustration Guidelines
- **Style**: Flat-vector with bold black outlines (uniform stroke weight ≈ 2–3 pt equivalent). All enclosed areas filled with **vibrant, saturated, child-friendly colours**.
- **Colour palette**: Use bright, cheerful, highly saturated colours appropriate for a children's educational card. Prefer primary and secondary colours (red, blue, yellow, green, orange, purple) with natural tones where appropriate.
- **Recognisability**: The drawing must be instantly identifiable by a 5-year-old child. Prefer the most iconic, canonical view of "${item}" (e.g. a red apple shown from the side with a brown stem and green leaf).
- **Simplicity**: Use clean, flat areas of colour with no gradients, no textures, and no 3D shading. Keep the design simple and bold.
- **Centering**: The illustration must be visually centred (optically balanced) with comfortable padding from the border.

### Typography Guidelines — Font: Montserrat Extra-Bold 800
- The label text is **"${label}"** — reproduce these exact characters.
- **Font**: Use **exactly Montserrat Extra-Bold (weight 800)**, a geometric sans-serif typeface. Do NOT substitute any other font.
- Key Montserrat traits to reproduce: perfectly circular "O", flat-top "A" without serif, square-shouldered "E" and "F", single-storey "a" at display sizes, wide and open letter proportions.
- The text must be horizontally and vertically centred within the label area.
- Letter-spacing should be slightly expanded (~5 % tracking) for readability.
- Text colour is pure black (#000000) on white background — no outline, no shadow, no effects on the text.

---

## STRICT CONSTRAINTS — MUST FOLLOW
1. **Use flat, vibrant colours** for the illustration. No gradients, no textures, no halftones.
2. **Bold black outlines** around all colour areas.
3. **No shading, shadows, or 3D effects.**
4. **No extra text, captions, logos, or watermarks** — only the item name in the label area.
5. **No background scenery or secondary objects** — the card interior is pure white except for the illustration and label.
6. **Maintain consistent stroke weight** throughout the entire illustration.
7. **The card must stand alone** — do not render a table, hand, or any object holding the card.
8. **Font must be Montserrat Extra-Bold 800** — do not use any other typeface for the label.

---

## QUALITY CHECKLIST (verify before outputting)
- [ ] Card has a visible rounded-border frame.
- [ ] There is a clear horizontal divider between illustration and label.
- [ ] The illustration is centred, recognisable, and vibrantly coloured.
- [ ] The label reads exactly "${label}".
- [ ] The label uses Montserrat Extra-Bold 800 letterforms (geometric, even weight, wide proportions).
- [ ] Colours are bright, flat, and child-friendly — no gradients or textures.
- [ ] No extraneous elements exist on or around the card.
`.trim();
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
// API Routes
// ---------------------------------------------------------------------------

app.post('/api/generate', async (req, res) => {
    try {
        const { item, isColored } = req.body;
        if (!item || typeof item !== 'string') {
            return res.status(400).json({ error: "Missing or invalid 'item' field." });
        }

        const sanitized = sanitizeItem(item);
        const prompt = isColored ? createColorPrompt(sanitized) : createPrompt(sanitized);
        const client = assertClient();

        let lastError: unknown;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await client.models.generateContent({
                    model: MODEL,
                    contents: { parts: [{ text: prompt }] },
                    config: {
                        temperature: 0.3,
                    },
                });

                const url = extractInlineImageData(response, sanitized);
                return res.json({ url });
            } catch (error) {
                lastError = error;
                const retriesLeft = MAX_RETRIES - attempt;
                if (retriesLeft > 0 && isRetryable(error)) {
                    const delay = BASE_DELAY_MS * 2 ** attempt;
                    console.warn(`Retryable error for "${sanitized}". Retrying in ${delay} ms…`, error);
                    await sleep(delay);
                    continue;
                }
                break;
            }
        }

        throw new Error(
            lastError instanceof Error ? lastError.message : "Unknown error generating flashcard."
        );
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err instanceof Error ? err.message : "Internal Server Error" });
    }
});

// ---------------------------------------------------------------------------
// Static file serving (for production only)
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // In production, the file will run from dist-server/server
    app.use(express.static(path.join(__dirname, '../../dist')));

    app.use((req, res) => {
        res.sendFile(path.join(__dirname, '../../dist', 'index.html'));
    });
}

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
