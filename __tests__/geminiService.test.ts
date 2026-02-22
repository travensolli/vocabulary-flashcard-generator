import { describe, expect, it } from "vitest";
import { extractInlineImageData } from "../services/geminiService";

const sampleBase64 = "ZGF0YQ==";

const buildResponse = (hasData: boolean) => ({
  candidates: [
    {
      content: {
        parts: hasData
          ? [
              {
                inlineData: {
                  data: sampleBase64,
                  mimeType: "image/png",
                },
              },
            ]
          : [],
      },
    },
  ],
});

describe("extractInlineImageData", () => {
  it("returns data URL when inline data is present", () => {
    const dataUrl = extractInlineImageData(buildResponse(true) as any, "apple");
    expect(dataUrl).toBe(`data:image/png;base64,${sampleBase64}`);
  });

  it("throws when no inline data is found", () => {
    expect(() => extractInlineImageData(buildResponse(false) as any, "banana")).toThrowError(
      /No image data found/
    );
  });
});
