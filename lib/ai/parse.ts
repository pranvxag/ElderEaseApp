// Basic parser utilities for extracting blood-sugar values (supports Devanagari digits)

const DEVANAGARI_MAP: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

export function normalizeDevanagariDigits(s: string) {
  return s.replace(/[०-९]/g, (d) => DEVANAGARI_MAP[d] ?? d);
}

export function extractSugarFromText(text?: string) {
  if (!text) return { value: null as number | null, unit: undefined, raw: null as string | null };
  const normalized = normalizeDevanagariDigits(text || '');
  // Look for explicit sugar keywords near numbers
  const sugarRegex = /(?:शुगर|blood\s*sugar|sugar|शुगर\s*है)[:\s\-]*(?:की)?\s*([0-9]{2,3}(?:\.[0-9]+)?)/i;
  const m = normalized.match(sugarRegex);
  if (m && m[1]) {
    const value = Number(m[1]);
    return { value, unit: 'mg/dL' as const, raw: m[0] };
  }

  // Fallback: any 2-3 digit number in the text
  const anyNum = normalized.match(/([0-9]{2,3}(?:\.[0-9]+)?)/);
  if (anyNum) {
    const value = Number(anyNum[1]);
    return { value, unit: 'mg/dL' as const, raw: anyNum[0] };
  }

  return { value: null as number | null, unit: undefined, raw: null as string | null };
}
