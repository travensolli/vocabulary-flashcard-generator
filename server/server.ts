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

const getIllustrationGuidelines = (item: string, realism: number, isColored: boolean): string => {
    const r = Math.max(1, Math.min(5, Math.round(realism)));
    if (!isColored) {
        // B&W guidelines per realism level
        const bwStyles: Record<number, string> = {
            1: `- **Style**: Extremely simplified cartoon. Use basic geometric shapes (circles, rectangles, triangles) to represent "${item}". Think clip-art or icon-level simplicity. Bold black outlines only, all fills pure white. Exaggerated, playful proportions.
- **Detail level**: Absolute minimum — use the fewest possible shapes. No fine details, no interior lines beyond what's essential for recognition.
- **No shading, no textures, no cross-hatching.**`,
            2: `- **Style**: Stylized children's book illustration. Soft, rounded shapes with slightly exaggerated proportions. Bold black outlines, all fills pure white. The drawing should feel warm and hand-drawn, like a storybook sketch.
- **Detail level**: Low-to-moderate — add just enough interior detail (e.g. a few lines for texture or features) to make "${item}" charming, but keep it simple.
- **No shading, no textures, no cross-hatching.**`,
            3: `- **Style**: Clean, standard educational flashcard illustration. Flat-vector look with bold black outlines (uniform stroke weight ≈ 2–3 pt). All enclosed areas filled with pure white.
- **Detail level**: Moderate — clear, tidy, and easy to identify. Use enough lines to be unambiguous but avoid unnecessary complexity.
- **Recognisability**: Prefer the most iconic, canonical view of "${item}" (e.g. an apple from the side with stem and leaf).
- **No cross-hatching, stippling, or decorative flourishes.**`,
            4: `- **Style**: Detailed semi-realistic black-and-white illustration, like a high-quality textbook or encyclopedia drawing. Use varied line weights (thinner for details, thicker for outlines). Include **cross-hatching or stippling for shading and volume**.
- **Detail level**: High — show realistic proportions, anatomical accuracy, surface textures (e.g. wood grain, fabric folds, feather detail). Add depth through line-based shading techniques.
- **Shading**: Use cross-hatching, stippling, or parallel lines to create tonal variation and a sense of three-dimensionality. Greys are acceptable through line density.`,
            5: `- **Style**: Hyper-realistic, photographic-quality black-and-white rendering, like a professional pencil drawing or charcoal sketch with full tonal range. Use the **complete greyscale spectrum** from pure white to pure black.
- **Detail level**: Maximum — render every surface texture, reflection, shadow, and material property with photographic accuracy.
- **Shading & Tone**: Use smooth gradients, soft shadows, ambient occlusion, and realistic lighting. Full greyscale tonal range is required. The illustration should look like a high-resolution black-and-white photograph.
- **Depth**: Include realistic depth of field, perspective, and volumetric lighting effects.`,
        };
        return bwStyles[r];
    } else {
        // Color guidelines per realism level
        const colorStyles: Record<number, string> = {
            1: `- **Style**: Extremely simplified cartoon with bold colours. Use basic geometric shapes (circles, rectangles, triangles) to represent "${item}". Bold black outlines with large flat fills of bright, primary colours. Think clip-art or emoji-level simplicity.
- **Colour palette**: Only bright primary and secondary colours (red, blue, yellow, green, orange, purple). No subtle hues.
- **Detail level**: Absolute minimum — fewest possible shapes. No fine details. Exaggerated, playful proportions.
- **No shading, no gradients, no textures.**`,
            2: `- **Style**: Friendly, stylized children's book illustration with vibrant colours. Soft rounded shapes with slightly exaggerated proportions. Bold black outlines, filled with cheerful flat colours.
- **Colour palette**: Bright, warm, child-friendly colours. Use 4–6 distinct flat colour fills.
- **Detail level**: Low-to-moderate — charming and approachable, like a hand-drawn storybook illustration.
- **No gradients, no textures, no 3D shading.**`,
            3: `- **Style**: Clean, standard educational flashcard illustration with bold colours. Flat-vector with bold black outlines (uniform stroke weight ≈ 2–3 pt). All enclosed areas filled with **vibrant, saturated, child-friendly colours**.
- **Colour palette**: Bright, cheerful, highly saturated colours. Prefer primary and secondary colours with natural tones where appropriate.
- **Detail level**: Moderate — clear, tidy, easy to identify.
- **Simplicity**: Use clean, flat areas of colour with no gradients, no textures, and no 3D shading.`,
            4: `- **Style**: Detailed semi-realistic colour illustration, like a high-quality educational textbook or nature guide. Use varied line weights with rich, naturalistic colours. Include **subtle shading and gradient fills** for depth and volume.
- **Colour palette**: Natural, realistic colour tones with subtle colour variations. Include highlights and shadows using lighter/darker shades of the base colours.
- **Detail level**: High — realistic proportions, accurate anatomy, surface textures rendered with colour variation. Add depth through colour-based shading.
- **Shading**: Use subtle gradients, soft colour transitions, and light/shadow to create three-dimensionality.`,
            5: `- **Style**: Hyper-realistic, photographic-quality full-colour rendering. The illustration should look like a professional studio photograph with accurate lighting, reflections, textures, and material properties.
- **Colour palette**: Completely naturalistic colours with full chromatic range, colour temperature variation, and ambient colour influence. Include specular highlights, subsurface scattering where appropriate, and environmental colour reflections.
- **Detail level**: Maximum — render every surface texture, reflection, shadow, and material property with photographic accuracy and full colour fidelity.
- **Lighting**: Use realistic directional lighting with soft shadows, ambient occlusion, and volumetric effects. Include realistic depth of field.`,
        };
        return colorStyles[r];
    }
};

const getConstraints = (realism: number, isColored: boolean): string => {
    const r = Math.max(1, Math.min(5, Math.round(realism)));

    // Common constraints for all levels
    const common = [
        '**No extra text, captions, logos, or watermarks** — only the item name in the label area.',
        '**No background scenery or secondary objects** — the card interior is white except for the illustration and label.',
        '**The card must stand alone** — do not render a table, hand, or any object holding the card.',
        '**Font must be Montserrat Extra-Bold 800** — do not use any other typeface for the label.',
    ];

    let specific: string[] = [];
    if (!isColored) {
        if (r <= 3) {
            specific = [
                '**Pure black (#000000) and pure white (#FFFFFF) ONLY.** Zero greys, zero colours, zero gradients, zero transparency.',
                '**No shading, shadows, textures, halftones, or 3D effects.**',
                '**Maintain consistent stroke weight** throughout the entire illustration.',
            ];
        } else if (r === 4) {
            specific = [
                '**Black and white only** — but greyscale tonal variation through cross-hatching or stippling is allowed and encouraged.',
                '**No colours.** Only black, white, and grey tones achieved through line techniques.',
                '**Use varied line weights** — thicker outlines, thinner interior detail lines.',
            ];
        } else {
            specific = [
                '**Full greyscale range allowed and required** — from pure white to pure black, including all grey tones, smooth gradients, and soft shadows.',
                '**No colours.** This is a monochrome (black-and-white) image with full tonal range.',
                '**Photographic realism is the goal** — render the subject as if it were a high-resolution B&W photograph.',
            ];
        }
    } else {
        if (r <= 3) {
            specific = [
                '**Use flat, vibrant colours** for the illustration. No gradients, no textures, no halftones.',
                '**Bold black outlines** around all colour areas.',
                '**No shading, shadows, or 3D effects.**',
                '**Maintain consistent stroke weight** throughout the entire illustration.',
            ];
        } else if (r === 4) {
            specific = [
                '**Use naturalistic colours with subtle shading.** Soft gradients and colour transitions are allowed and encouraged.',
                '**Outlines may be softer or integrated** into the colour rendering.',
                '**Include light and shadow** to create three-dimensional depth.',
            ];
        } else {
            specific = [
                '**Full photorealistic colour rendering required.** Use accurate, natural colours with full tonal and chromatic range.',
                '**No outlines** — forms should be defined by colour, light, and shadow, as in a photograph.',
                '**Include realistic lighting, shadows, reflections, and material textures.**',
                '**Photographic realism is the goal** — render the subject as if captured by a professional camera.',
            ];
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
        if (r <= 3) {
            base.push('The entire image is strictly black-and-white with no greys.');
        } else if (r === 4) {
            base.push('The illustration uses cross-hatching or stippling for shading and volume.');
        } else {
            base.push('The illustration has photographic-quality greyscale rendering with full tonal range.');
        }
    } else {
        if (r <= 3) {
            base.push('Colours are bright, flat, and child-friendly — no gradients or textures.');
        } else if (r === 4) {
            base.push('Colours are naturalistic with subtle shading and depth.');
        } else {
            base.push('The illustration has photorealistic colour rendering with accurate lighting and materials.');
        }
    }

    base.push('No extraneous elements exist on or around the card.');
    return base.map(c => `- [ ] ${c}`).join('\n');
};

const createFlashcardPrompt = (item: string, realism: number = 3, isColored: boolean = false): string => {
    const label = item.toUpperCase();
    const style = getRealismStyle(realism);

    // Choose the right illustration descriptor based on realism and color
    let illustrationDesc = "";
    if (realism <= 3) {
        illustrationDesc = isColored ? "full-colour drawing" : "line-art drawing";
    } else if (realism === 4) {
        illustrationDesc = isColored ? "detailed colour illustration" : "detailed illustration";
    } else {
        illustrationDesc = isColored ? "photorealistic colour rendering" : "photorealistic rendering";
    }

    const roleName = isColored ? "vibrant, full-colour" : "black-and-white";

    return `
# ROLE
You are a senior illustrator specialising in ${roleName} vocabulary flashcards.

# MODEL NOTE (Gemini Image)
Follow the specified realism level precisely. Do not mix styles or drift toward a different realism level.

# TARGET REALISM LEVEL: ${style.label} (${realism}/5)
**THIS IS THE MOST IMPORTANT INSTRUCTION.** ${style.illustration}
If any instruction conflicts with realism level, the realism level wins.

# OBJECTIVE
Generate **one** vocabulary flashcard image for the item: **"${item}"**.

---

## CARD SPECIFICATIONS

### Dimensions & Layout
| Zone | Proportion | Content |
|------|-----------|---------|
| Outer card | 3 : 4 portrait ratio | Solid black rounded-corner border (≈ 3 % of card width) on a white background. |
| Illustration area | Top 75 % of the inner card | Centred, ${illustrationDesc} of "${item}". |
| Divider | — | A single, solid black horizontal line spanning the full inner width, separating the two areas. |
| Label area | Bottom 25 % of the inner card | The word **"${label}"** centred in **Montserrat Extra-Bold (800 weight)** typeface. |

### Illustration Guidelines
${getIllustrationGuidelines(item, realism, isColored)}
- **Centering**: The illustration must be visually centred (optically balanced) with comfortable padding from the border.

### Typography Guidelines — Font: Montserrat Extra-Bold 800
- The label text is **"${label}"** — reproduce these exact characters.
- **Font**: Use **exactly Montserrat Extra-Bold (weight 800)**, a geometric sans-serif typeface. Do NOT substitute any other font.
- The text must be horizontally and vertically centred within the label area.
- Letter-spacing should be slightly expanded (~5 % tracking) for readability.
- Text colour is pure black (#000000) on white background.

---

## STRICT CONSTRAINTS — MUST FOLLOW
${getConstraints(realism, isColored)}
${realism <= 3
        ? '5. **Do not add shading, gradients, textures, or photographic detail.** Keep it intentionally simple.'
        : realism === 4
            ? '5. **Use semi-realistic detail only.** Avoid full photographic realism.'
            : '5. **Photographic realism is mandatory.** Avoid illustration-like line art.'}

---

## QUALITY CHECKLIST (verify before outputting)
${getChecklist(realism, isColored)}
- [ ] The label reads exactly "${label}".
- [ ] The label uses Montserrat Extra-Bold 800 letterforms.
 - [ ] The realism level clearly matches ${style.label} (${realism}/5) and does not drift.
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
        const { item, isColored, realism } = req.body;
        if (!item || typeof item !== 'string') {
            return res.status(400).json({ error: "Missing or invalid 'item' field." });
        }

        const realismLevel = typeof realism === 'number' ? realism : 3;
        const sanitized = sanitizeItem(item);
        const prompt = createFlashcardPrompt(sanitized, realismLevel, !!isColored);
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
