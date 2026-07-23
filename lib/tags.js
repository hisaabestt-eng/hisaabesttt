// Tags are stored as bracket groups in a single text column, e.g. " [July,2025] [urgent] ".
export function parseTags(tagsText) {
  if (!tagsText) return [];
  const matches = tagsText.match(/\[([^\]]+)\]/g) || [];
  return matches.map((m) => m.slice(1, -1).trim());
}

export function addTag(tagsText, newTag) {
  const clean = newTag.trim();
  if (!clean) return tagsText;
  const existing = parseTags(tagsText);
  if (existing.some((t) => t.toLowerCase() === clean.toLowerCase())) {
    return tagsText;
  }
  return `${(tagsText || "").trim()} [${clean}]`.trim();
}

export function removeTag(tagsText, tagToRemove) {
  const clean = tagToRemove.trim().toLowerCase();
  const remaining = parseTags(tagsText).filter((t) => t.toLowerCase() !== clean);
  return remaining.map((t) => `[${t}]`).join(" ");
}
