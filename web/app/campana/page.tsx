"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui";

type Campaign = {
  as_of: string;
  restricted?: boolean;
  warnings: string[];
  snapshots: { date: string; n_houses: number }[];
};

export default function Campana() {
  const [data, setData] = useState<Campaign | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/data/campaign.json").then((r) => {
      if (!r.ok) throw new Error("Datos no disponibles");
      return r.json() as Promise<Campaign>;
    }).then(setData).catch(() => setError(true));
  }, []);
  return <div>
    <SectionTitle kicker="Seguimiento" title="Campaña 29N" desc="Información disponible por fecha de publicación, no una previsión electoral." />
    {error && <p role="alert">No se han podido cargar los datos de campaña.</p>}
    {!data && !error && <p role="status">Cargando datos…</p>}
    {data && <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="font-serif text-xl">Corte: {data.as_of}</h2>
      {data.restricted ? <p>Contenido restringido por el calendario editorial.</p> : <>
        {data.snapshots.at(-1)?.n_houses ? <p>Encuestadoras con fecha de publicación verificada: {data.snapshots.at(-1)?.n_houses}.</p> :
          <p>No hay suficientes fechas de publicación verificadas para reconstruir una serie histórica. La fecha de campo no demuestra cuándo se publicó una encuesta.</p>}
        <ul className="mt-4 list-disc pl-5 text-sm">{data.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        <p className="mt-4"><Link href="/encuestas" className="text-blue-700 underline">Explorar el catálogo de encuestas</Link></p>
      </>}
    </section>}
  </div>;
}
