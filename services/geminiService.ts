// ---------------------------------------------------------------------------
// Client API Service
// ---------------------------------------------------------------------------

export const generateFlashcard = async (item: string, isColored: boolean = false): Promise<string> => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ item, isColored }),
  });

  if (!response.ok) {
    let errorMsg = "Unknown error generating flashcard.";
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {
      errorMsg = await response.text();
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (!data.url) {
    throw new Error("No URL returned from server.");
  }

  return data.url;
};
