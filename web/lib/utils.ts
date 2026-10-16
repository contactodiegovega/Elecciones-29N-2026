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
  return new Intl.NumberFormat("es-ES").format(n);
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "Dato no disponible";
  return `${n.toFixed(digits)} %`;
}

export function fmtPp(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "Dato no disponible";
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(digits)} pp`;
}

export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
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
