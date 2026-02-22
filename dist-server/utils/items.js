export const DEFAULT_MAX_ITEMS = 20;
export const parseItems = (inputText, maxItems = DEFAULT_MAX_ITEMS) => {
    const rawItems = inputText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    const seen = new Set();
    const result = [];
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
