import { normalizeDevanagariDigits } from './parse';

export interface LabValue {
  key: string;
  value: number;
  unit?: string;
  raw?: string;
}

// Very small heuristic extractor for common lab values (blood sugar etc.)
export function parseLabReport(text?: string): LabValue[] {
  if (!text) return [];
  const normalized = normalizeDevanagariDigits(text || '');
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const results: LabValue[] = [];

  const sugarRegexes = [
    /blood sugar[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*(mg\/?dL|mg|mmol\/?L)?/i,
    /random blood sugar[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*(mg\/?dL|mg|mmol\/?L)?/i,
    /fasting blood sugar[:\s]*([0-9]+(?:[.,][0-9]+)?)\s*(mg\/?dL|mg|mmol\/?L)?/i,
    /शुगर[:\s]*([0-9]+(?:[.,][0-9]+)?)/i,
  ];

  for (const line of lines) {
    for (const r of sugarRegexes) {
      const m = line.match(r);
      if (m) {
        const raw = m[0];
        const value = Number(String(m[1]).replace(',', '.'));
        const unit = m[2] || 'mg/dL';
        results.push({ key: 'blood_sugar', value, unit, raw });
      }
    }
  }

  return results;
}
