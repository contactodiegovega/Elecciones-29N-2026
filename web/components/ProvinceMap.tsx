"use client";
import { useEffect, useState } from "react";
import * as echarts from "echarts/core";
import EChart from "./EChart";
import { loadGeo } from "@/lib/data";
import type { SimulatorProvince } from "@/lib/types";

export default function ProvinceMap({ provinces, selected, onSelect, height = 440 }: {
  provinces: Pick<SimulatorProvince, "province_code" | "province_name" | "seats" | "seats_2023" | "seats_2026">[]; selected?: string; onSelect: (code: string) => void; height?: number;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    loadGeo().then(g => {
      // Display-only inset: keep the source geometry intact and translate Canary
      // islands together, preserving their relative positions and their scale.
      const inset: GeoJSON.FeatureCollection = { ...g, features: g.features.map(f => {
        if (!["35", "38"].includes(f.properties?.province_code)) return f;
        const translate = (ring: GeoJSON.Position[]) => ring.map(([x, y]) => [x + 7, y + 6]);
        const geometry = f.geometry.type === "MultiPolygon"
          ? { ...f.geometry, coordinates: f.geometry.coordinates.map(p => p.map(translate)) }
          : f.geometry.type === "Polygon" ? { ...f.geometry, coordinates: f.geometry.coordinates.map(translate) } : f.geometry;
        return { ...f, geometry };
      }) };
      echarts.registerMap("29n-seats", inset as unknown as Parameters<typeof echarts.registerMap>[1]);
      if (alive) setReady(true);
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);
  if (!ready) return <div style={{ height }} className="flex items-center justify-center text-sm text-stone-500" role="status">{error ? "Mapa no disponible. Utiliza el selector de provincia." : "Preparando las 52 circunscripciones…"}</div>;
  return <><EChart height={height} ariaLabel="¿Cuántos diputados elige tu provincia en 2026? Canarias se representa desplazada al suroeste, a la misma escala. Selección alternativa en el desplegable." testId="mapa-provincias" option={{
    animationDuration: 250,
    tooltip: { trigger: "item", renderMode: "richText", formatter: (p: { name?: string }) => {
      const row = provinces.find(r => r.province_code === p.name);
      return row ? `${row.province_name}\n${row.seats_2026 ?? row.seats} diputados · 2026\n${row.seats_2023} diputados · 2023` : "";
    } },
    visualMap: { min: 1, max: 38, show: false, inRange: { color: ["#d9eee8", "#63a69b", "#0f766e", "#14213d"] } },
    series: [{ type: "map", map: "29n-seats", nameProperty: "province_code", roam: false, selectedMode: "single",
      layoutCenter: ["50%", "47%"], layoutSize: "94%",
      data: provinces.map(p => ({ name: p.province_code, value: p.seats_2026 ?? p.seats, selected: p.province_code === selected })),
      itemStyle: { borderColor: "#fff", borderWidth: 1 },
      emphasis: { label: { show: false }, itemStyle: { areaColor: "#f4bf58" } },
      select: { label: { show: false }, itemStyle: { areaColor: "#e5aa3b" } },
    }],
  }} onEvents={{ click: p => { const code = (p as { name?: string }).name; if (code && provinces.some(r => r.province_code === code)) onSelect(code); } }} />
    <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line p-2 text-xs text-stone-500"><span>Canarias desplazada · misma escala ·</span>{["35", "38", "51", "52"].map(code => {
      const p = provinces.find(p => p.province_code === code);
      return p ? <button type="button" key={code} onClick={() => onSelect(code)} className="rounded border border-line px-2 py-1 text-ink hover:border-accent" aria-label={`Seleccionar ${p.province_name}`}>{p.province_name} · {p.seats_2026 ?? p.seats}</button> : null;
    })}</div>
  </>;
}
