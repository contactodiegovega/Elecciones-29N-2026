import Link from "next/link";
import { downloadCSV } from "@/lib/utils";

export function Provenance({ items }: { items: string[] }) {
  return (
    <div className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-stone-500">
      <span className="font-semibold uppercase tracking-wide text-stone-600">Fuentes y notas: </span>
      {items.map((item, i) => (
        <span key={item}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {item}
        </span>
      ))}
    </div>
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
      className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent"
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

export function Loading({ what = "datos reales" }: { what?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-line bg-white p-8" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
      <p className="text-sm text-stone-500">Cargando {what}…</p>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert">
      <p className="font-serif text-lg text-red-900">No se han podido cargar los datos</p>
      <p className="mt-1 break-words text-sm text-red-800">{message}</p>
      <p className="mt-2 text-xs text-red-700">
        Comprueba que los JSON de <code>web/public/data</code> existen y cumplen el contrato,
        y vuelve a ejecutar el exportador si es necesario.
      </p>
    </div>
  );
}

export function SectionTitle({ kicker, title, desc, updated, sources }: {
  kicker: string; title: string; desc?: string; updated?: string; sources?: string[];
}) {
  return (
    <header className="mb-6 border-b border-line pb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{kicker}</p>
      <h1 className="mt-1 font-serif text-3xl leading-tight text-ink md:text-4xl">{title}</h1>
      {desc && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-stone-600">{desc}</p>}
      {(updated || sources) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
          {updated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5">
              Datos actualizados: {updated}
            </span>
          )}
          {sources?.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
              {s}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

export function Card({ title, subtitle, children, className = "", actions }: {
  title?: string; subtitle?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(20,33,61,0.04)] md:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="font-serif text-xl text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, accent }: {
  label: string; value: string | number; hint?: string; accent?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 font-serif text-2xl leading-none text-ink" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-stone-500">{hint}</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-stone-700">
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}

export const selectClass =
  "rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none";

export const buttonClass =
  "rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent";

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "good" | "info" }) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-stone-50 text-stone-600",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    good: "border-emerald-300 bg-emerald-50 text-emerald-900",
    info: "border-sky-300 bg-sky-50 text-sky-900",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Notice({ title, children, tone = "warn" }: {
  title: string; children: React.ReactNode; tone?: "warn" | "info";
}) {
  const cls = tone === "warn"
    ? "border-amber-300 bg-amber-50 text-amber-950"
    : "border-sky-300 bg-sky-50 text-sky-950";
  return (
    <section className={`rounded-xl border p-4 text-sm ${cls}`} role="note">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 leading-relaxed">{children}</div>
    </section>
  );
}

export function LinkCard({ href, title, desc, meta }: { href: string; title: string; desc: string; meta?: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-xl border border-line bg-white p-4 transition hover:border-accent hover:shadow-sm">
      {meta && <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">{meta}</p>}
      <p className="mt-1 font-serif text-xl text-ink group-hover:text-accent">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-stone-600">{desc}</p>
    </Link>
  );
}

export function DataCut({ status }: { status?: { today_madrid: string; phase: string; reason: string } }) {
  if (!status) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs text-stone-500">
      Corte de datos: <strong className="text-stone-700">{status.today_madrid}</strong> · fase: {status.phase} · {status.reason}
    </div>
  );
}
