import type { ColorEntry } from "./types";

const FALLBACK = ["#696969", "#8C564B", "#7F7F7F", "#BCBD22", "#17BECF", "#607D8B"];

export function hashIndex(key: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % n;
}

/** Réplica de get_party_color(): registro primero, fallback determinista después. */
export function partyColor(partyId: string | null, registry: ColorEntry[]): { hex: string; origin: "registry" | "fallback" } {
  if (partyId) {
    const e = registry.find((r) => r.party_id === partyId);
    if (e) return { hex: e.hex_color, origin: "registry" };
  }
  return { hex: FALLBACK[hashIndex(partyId ?? "UNKNOWN", FALLBACK.length)], origin: "fallback" };
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "Dato no disponible";
  return new Intl.NumberFormat("es-ES").format(Math.round(n));
}

export function fmtDec(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "Dato no disponible";
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "Dato no disponible";
  return `${fmtDec(n, digits)} %`;
}

export function fmtPp(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "Dato no disponible";
  const s = n > 0 ? "+" : "";
  return `${s}${fmtDec(n, digits)} pp`;
}

export function fmtMillions(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "Dato no disponible";
  return `${fmtDec(n / 1e6, digits)} M`;
}

export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtDate(iso: string | null | undefined, long = false): string {
  if (!iso) return "fecha no disponible";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  if (long) return `${Number(d)} de ${MONTHS[Number(mo) - 1] ?? mo} de ${y}`;
  return `${Number(d)} ${MONTHS[Number(mo) - 1] ?? mo} ${y}`;
}

export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[1].slice(2)}-${m[2]}`;
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}

export function pearson(points: [number, number][]): number {
  if (points.length < 3) return NaN;
  const mx = mean(points.map((p) => p[0]));
  const my = mean(points.map((p) => p[1]));
  const cov = points.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
  const sx = Math.sqrt(points.reduce((a, p) => a + (p[0] - mx) ** 2, 0));
  const sy = Math.sqrt(points.reduce((a, p) => a + (p[1] - my) ** 2, 0));
  return sx && sy ? cov / (sx * sy) : NaN;
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const head = Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export type DHondtInput = {
  provinces: { code: string; name: string; seats: number; votes: Record<string, number> }[];
  parties: string[];
  thresholdPct: number;
};

export type DHondtResult = {
  byProvince: {
    code: string;
    name: string;
    seats: number;
    votes: Record<string, number>;
    share: Record<string, number>;
    allocation: Record<string, number>;
    thresholdApplied: boolean;
  }[];
  national: Record<string, number>;
};

/**
 * Reparto D'Hondt provincial con umbral legal sobre votos válidos de la
 * circunscripción. Replica las reglas usadas en la validación 2023.
 */
export function allocateDHondt({ provinces, parties, thresholdPct }: DHondtInput): DHondtResult {
  const national: Record<string, number> = Object.fromEntries(parties.map((p) => [p, 0]));
  const byProvince: DHondtResult["byProvince"] = [];

  for (const prov of provinces) {
    const totalVotes = parties.reduce((a, p) => a + Math.max(0, prov.votes[p] ?? 0), 0);
    const share: Record<string, number> = {};
    for (const p of parties) {
      const v = Math.max(0, prov.votes[p] ?? 0);
      share[p] = totalVotes > 0 ? (v / totalVotes) * 100 : 0;
    }
    const eligible = parties.filter((p) => share[p] >= thresholdPct && prov.seats > 0);
    const allocation: Record<string, number> = Object.fromEntries(parties.map((p) => [p, 0]));
    const quotients: { party: string; value: number }[] = [];
    for (const p of eligible) {
      const v = Math.max(0, prov.votes[p] ?? 0);
      for (let d = 1; d <= prov.seats; d++) quotients.push({ party: p, value: v / d });
    }
    quotients.sort((a, b) => b.value - a.value);
    for (let i = 0; i < prov.seats && i < quotients.length; i++) {
      allocation[quotients[i].party] += 1;
    }
    for (const p of parties) national[p] += allocation[p];
    byProvince.push({
      code: prov.code,
      name: prov.name,
      seats: prov.seats,
      votes: prov.votes,
      share,
      allocation,
      thresholdApplied: eligible.length !== parties.filter((p) => (prov.votes[p] ?? 0) > 0).length,
    });
  }
  return { byProvince, national };
}

export function topN(record: Record<string, number>, n = 5): [string, number][] {
  return Object.entries(record).sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}
