import { downloadCSV } from "@/lib/utils";

export function Provenance({ items }: { items: string[] }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-stone-500">
      <span className="font-semibold">Procedencia: </span>
      {items.join(" · ")}
    </p>
  );
}

export function CsvButton({ filename, rows, label }: {
  filename: string; rows: Record<string, unknown>[]; label?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => downloadCSV(filename, rows)}
      className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-accent"
      aria-label={`Exportar ${filename} en CSV`}
    >
      {label ?? "Exportar CSV"}
    </button>
  );
}

export function Empty({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-stone-500" role="status">
      Dato no disponible: {what}.
    </div>
  );
}

export function SectionTitle({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return (
    <header className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">{kicker}</p>
      <h1 className="font-serif text-3xl text-ink md:text-4xl">{title}</h1>
      {desc && <p className="mt-2 max-w-3xl text-stone-600">{desc}</p>}
    </header>
  );
}
