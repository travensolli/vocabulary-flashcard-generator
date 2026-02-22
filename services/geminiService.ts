
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

// Vite exposes env vars as import.meta.env; keep a fallback for node-style envs in case of SSR/tests.
const apiKey = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_GEMINI_API_KEY : undefined)
  || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);

if (!apiKey) {
  console.warn("Gemini API key not set; generation will fail until configured.");
}

let ai: GoogleGenAI | null = apiKey ? new GoogleGenAI({ apiKey }) : null;
const model = "gemini-2.5-flash-image";

const assertClient = () => {
  if (!apiKey) {
    throw new Error("Gemini API key missing. Set VITE_GEMINI_API_KEY before generating.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const extractInlineImageData = (response: GenerateContentResponse, item: string) => {
  const candidates = response.candidates ?? [];
  const parts = candidates[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData) {
      const base64EncodeString: string = part.inlineData.data;
      const mimeType = part.inlineData.mimeType;
      return `data:${mimeType};base64,${base64EncodeString}`;
    }
  }

  throw new Error(`No image data found in response for item: ${item}`);
};

const createPrompt = (item: string) => `
You are an expert image generator. Your goal is to create any item requested by the user, always in the same visual style, inspired by black and white city place cards. These illustrations will be used in black and white English books for children up to 9 years old, for teaching vocabulary. Therefore, the images must be clear, simple, and easy to understand.

### GENERAL STYLE
- Art type: simple line art, black and white.
- Colors: only black on a white background. Do not use colors or shading.
- Stroke:
  - Clean, continuous, and well-defined lines.
  - Medium and uniform thickness, without texture or noise.
  - Few fine details; clear and legible appearance for young children.

### CARD COMPOSITION
- Card format:
  - A rectangle/square with slightly rounded corners.
  - White background.
  - A soft outer border in very light gray.
- Drawing area:
  - The main element (what the user requests) should be centered in the upper/central part of the card.
  - Show the object/scene simply, frontally, or in slight perspective, always easy to recognize.
  - Use few auxiliary elements, only what is necessary to identify the theme.
  - Do not fill the card with many details; maintain a clean and organized look.
- Label text:
  - At the bottom of the card, leave an imaginary band for the text.
  - Write the name of the requested item in UPPERCASE letters, in English.
  - Thick, simple, sans-serif font, similar to that used in children's educational materials.
  - The text must be black, centered, and very legible.

### STYLE AND AUDIENCE
- Target audience: children up to 9 years old, in the process of learning English.
- Use: textbooks, flashcards, vocabulary cards.
- Visual mood: friendly, clear, fun, but minimalist; no excessive realism.
- Proportions: slightly stylized and simplified, but not exaggerated caricatures.

### RESTRICTIONS
- Do not use gradients, textures, complex shadows, or 3D effects.
- Do not use colors; only black lines on a white background.
- Do not add complex scenarios: the focus is on the main icon inside the card.
- Maintain the same style in all requests, regardless of the subject.

### HOW TO RESPOND TO EACH REQUEST
Whenever the user requests a new item, follow this pattern:
1. Create a single card with the above style.
2. Draw the requested item as the main icon inside the card.
3. Write the name of the item in uppercase at the bottom, in the same label style described.

Generate a flashcard for the following item: "${item}"
`;

export const generateFlashcard = async (item: string): Promise<string> => {
    try {
      const prompt = createPrompt(item);
      const client = assertClient();

      const response = await client.models.generateContent({
        model: model,
        contents: {
          parts: [{ text: prompt }],
        },
      });

      return extractInlineImageData(response, item);
    } catch (error) {
      console.error(`Error generating flashcard for "${item}":`, error);
      throw new Error(`Failed to generate flashcard for "${item}".`);
    }
};
