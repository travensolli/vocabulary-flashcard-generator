export const DEFAULT_MAX_ITEMS = 20;

export const parseItems = (inputText: string, maxItems: number = DEFAULT_MAX_ITEMS): string[] => {
  const rawItems = inputText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of rawItems) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
};
