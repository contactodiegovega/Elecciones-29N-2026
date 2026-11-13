"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorBox, LinkCard, Loading, Notice, Provenance, StatCard, Tag } from "@/components/ui";
import {
  loadCampaign, loadMeta, loadModelRegistry, loadPollSources, loadPublicationStatus, loadSimulator,
  type Campaign, type Meta, type ModelRegistry, type PollSources, type PublicationStatus, type Simulator,
} from "@/lib/data";
import { fmtDate, fmtInt } from "@/lib/utils";

export default function Home() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [sim, setSim] = useState<Simulator | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sources, setSources] = useState<PollSources | null>(null);
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [registry, setRegistry] = useState<ModelRegistry | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadMeta(), loadSimulator(), loadCampaign(), loadPollSources(), loadPublicationStatus(), loadModelRegistry()])
      .then(([m, s, c, ps, st, r]) => {
        setMeta(m); setSim(s); setCampaign(c); setSources(ps); setStatus(st); setRegistry(r);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!meta || !sim || !campaign || !registry) return <Loading what="el observatorio" />;

  const changed = sim.provinces.filter((p) => (p.seats_change ?? 0) !== 0);
  const measurements = sources?.totals.n_measurements ?? 0;
  const bestBaseline = registry.versions.find((v) => v.version_id === registry.best_baseline.version_id);
  const asOf = status?.today_madrid ?? meta.as_of ?? "2026-11-13";

  return (
    <div className="space-y-10">
      <section className="grid gap-8 border-b border-line pb-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Elecciones generales · 29N 2026</p>
            {status && <Tag tone={status.restricted ? "warn" : "info"}>{status.phase}</Tag>}
          </div>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-[1.03] text-ink md:text-6xl">
            Qué sabemos del 29N, sin inventar lo que no sabemos.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-600">
            Cuántos diputados elige cada provincia, qué dicen las encuestas y qué podemos —y qué no podemos—
            concluir de los modelos. Datos con fuente, fecha y límites explícitos.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/diputados" className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent">
              Ver diputados por provincia
            </Link>
            <Link href="/encuestas" className="rounded-md border border-line bg-white px-4 py-2.5 text-sm text-ink transition hover:border-accent hover:text-accent">
              Explorar encuestas
            </Link>
            <Link href="/prediccion" className="rounded-md border border-line bg-white px-4 py-2.5 text-sm text-ink transition hover:border-accent hover:text-accent">
              Mi predicción · experimental
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-500">
            <Tag>Corte: {fmtDate(asOf)}</Tag>
            <Tag>{meta.elections.length} elecciones históricas</Tag>
            <Tag>{sim.provinces.length} provincias</Tag>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">El dato que cambia el 29N</p>
          <p className="mt-2 font-serif text-3xl leading-tight text-ink">350 escaños, nueva distribución</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            El RD 806/2026 mantiene el total y ajusta dos provincias. No depende de encuestas: depende del censo.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {changed.map((p) => (
              <li key={p.province_code} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                <span className="font-medium text-ink">{p.province_name}</span>
                <span className="tabular text-stone-600">
                  {p.seats_2023} → <strong className="text-ink">{p.seats_2026 ?? p.seats}</strong>{" "}
                  <span className={(p.seats_change ?? 0) > 0 ? "text-emerald-700" : "text-red-700"}>
                    ({(p.seats_change ?? 0) > 0 ? "+" : ""}{p.seats_change})
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Link href="/diputados" className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-2">
            Ver las 52 provincias
          </Link>
        </div>
      </section>

      {status?.restricted && (
        <Notice title="Veda de publicación activa">
          {status.reason} Ventana: {fmtDate(status.restriction_start)} → {fmtDate(status.restriction_end)}.{" "}
          {status.legal_note}
        </Notice>
      )}

      <section aria-label="Datos clave" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Escaños en juego" value={sim.total_seats} hint="Congreso de los Diputados" />
        <StatCard label="Provincias" value={sim.provinces.length} hint="Cada una es una circunscripción" />
        <StatCard label="Sondeos registrados" value={fmtInt(campaign.n_polls_total ?? 0)} hint={`${fmtInt(campaign.n_houses ?? 0)} casas · ${fmtInt(measurements)} mediciones`} />
        <StatCard
          label="Proyección publicable"
          value="Ninguna"
          hint={`Gate ${registry.status.toUpperCase()} · sin resultados de 2026 para validar`}
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Empieza por aquí</p>
            <h2 className="mt-1 font-serif text-2xl text-ink md:text-3xl">Cuatro formas de mirar el 29N</h2>
          </div>
          <p className="max-w-md text-sm text-stone-500">Cada sección dice qué dato usa y qué no puede afirmar.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <LinkCard href="/diputados" title="Diputados por provincia" desc="Los 350 escaños, provincia a provincia, con el cambio oficial de 2026 y el resultado de 2023." meta="Oficial · BOE" />
          <LinkCard href="/encuestas" title="Encuestas" desc="Sondeos por casa, tipo y fecha. Estimación de voto e intención directa siempre separadas." meta={`${fmtInt(campaign.n_polls_total ?? 0)} sondeos`} />
          <LinkCard href="/prediccion" title="Mi predicción" desc="El experimento de estimar el voto, contado con honestidad: qué se probó y por qué no se publica." meta={`Gate ${registry.status.toUpperCase()}`} />
          <LinkCard href="/analisis" title="Más análisis" desc="Histórico, participación, demografía, modelos retrospectivos, simulador y metodología." meta="6 secciones" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5">
          <Tag tone="good">Verificado</Tag>
          <h3 className="mt-3 font-serif text-xl text-ink">Datos oficiales</h3>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-stone-600">
            <li>Resultados y participación: Ministerio del Interior.</li>
            <li>Escaños por provincia: RD 806/2026, publicado en el BOE.</li>
            <li>Censo, padrón y EPA: INE.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Tag tone="info">Experimental</Tag>
          <h3 className="mt-3 font-serif text-xl text-ink">Modelos, sin promesas</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            La mejor referencia es simple: {bestBaseline?.label.toLowerCase()}, con un error medio de{" "}
            {registry.best_baseline.mae_macro_pp.toFixed(2)} puntos. El mejor ML no la supera.
          </p>
          <Link href="/prediccion" className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-2">
            Ver el registro de versiones
          </Link>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Tag tone="neutral">Herramienta</Tag>
          <h3 className="mt-3 font-serif text-xl text-ink">Simulador hipotético</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            «Si estos fueran los votos, el reparto sería este». Aplica D&apos;Hondt y el umbral del 3 %, pero no
            predice pactos, investidura ni voto útil.
          </p>
          <Link href="/simulador" className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-2">
            Abrir el simulador
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 md:p-6">
        <h2 className="font-serif text-2xl text-ink">Lo que no vas a encontrar aquí</h2>
        <div className="mt-3 grid gap-3 text-sm leading-relaxed text-stone-600 md:grid-cols-3">
          <p><strong className="text-ink">Ni un pronóstico del 29N.</strong> No hay probabilidades de victoria ni escaños proyectados por partido.</p>
          <p><strong className="text-ink">Ni fechas inventadas.</strong> Cuando no consta la publicación de una encuesta, se marca como desconocida.</p>
          <p><strong className="text-ink">Ni comparaciones engañosas.</strong> Estimación de voto e intención directa no se mezclan en una misma media.</p>
        </div>
        <Provenance items={[
          "Interior, INE, BOE y compilación de encuestas con atribución",
          "Los huecos son «dato no disponible», nunca cero",
          "El registro de modelos conserva versiones, cortes y métricas auditadas",
        ]} />
      </section>
    </div>
  );
}
