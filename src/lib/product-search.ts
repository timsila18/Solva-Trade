export function normalizeProductSearch(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(millilitres?|milliliters?|ml)\b/g, "$1ml")
    .replace(/(\d+(?:\.\d+)?)\s*(litres?|liters?|l(?:ts?)?)\b/g, "$1l")
    .replace(/[^a-z0-9.]+/g, " ").trim().replace(/\s+/g, " ");
}

export function productSearchScore(label: string, query: string): number {
  if (!query) return 0;
  const compactLabel = label.replace(/\s/g, "");
  const terms = query.split(" ");
  if (!terms.every((term) => compactLabel.includes(term))) return -1;
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.split(" ").some((word) => word.startsWith(terms[0]))) return 2;
  return 3;
}
