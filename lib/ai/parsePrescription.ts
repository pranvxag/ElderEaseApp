import { normalizeDevanagariDigits } from './parse';

export interface ParsedMed {
  name: string;
  dosage?: string | null;
  raw: string;
}

export function parsePrescription(text?: string): ParsedMed[] {
  if (!text) return [];
  const normalized = normalizeDevanagariDigits(text || '');
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const meds: ParsedMed[] = [];

  const dosageRegex = /(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|iu|iu\/ml|mcg|µg|tablet|tab|tabs|pills|drops|capsule|caps))/i;
  const pillCountRegex = /(\d+)\s*(?:tablet|tab|tabs|pills|pills\.|पिल|गोलियां|गोलियाँ)/i;

  for (const line of lines) {
    // Skip common headers
    if (/^rx\b/i.test(line)) continue;

    let match = line.match(dosageRegex);
    let dosage: string | null = null;
    let name = line;

    if (match) {
      dosage = match[0];
      const idx = line.indexOf(match[0]);
      if (idx > 0) name = line.slice(0, idx).trim();
    } else {
      const m2 = line.match(pillCountRegex);
      if (m2) {
        dosage = m2[0];
        const idx = line.indexOf(m2[0]);
        if (idx > 0) name = line.slice(0, idx).trim();
      }
    }

    // Heuristic: require at least one ASCII or Devanagari letter in name and a numeric/dosage indicator
    if (/[A-Za-z\u0900-\u097F]/.test(name) && (dosage || /\d/.test(line))) {
      meds.push({ name: name.replace(/^take\b\s*/i, '').trim(), dosage, raw: line });
    }
  }

  return meds;
}
