# Licencias y publicación — FASE 6

## Datos redistribuidos en `web/public/` (lícitos con atribución visible)

| Artefacto | Fuente | Licencia | Atribución en web |
|---|---|---|---|
| Resultados agregados JSON | Ministerio del Interior | Uso público oficial | Footer + procedencia por gráfico |
| Demografía/renta/EPA JSON | INE (36780/2852/72989/53687/67217) | **CC BY 4.0** | Footer + procedencia («citar INE») |
| Encuestas JSON | Compilación Wikipedia | **CC BY-SA 4.0** | Procedencia con revisiones; NO transfiere permisos de fuentes primarias |
| `spain_provinces.geojson` | Eurostat GISCO NUTS 2021 | **©EuroGeographics, reutilizable con atribución** | Procedencia del mapa + `maps/` |
| Métricas ML | Cómputo propio (fases 3–4) | Propio | Model cards enlazadas |

## Exclusiones deliberadas del deploy

- `data/raw/*` (brutos grandes, gitignored) y `web/public/maps/nuts3_europe_03M.geojson`
  (16 MB, movido a `data/raw/`, gitignored): no se publican; el exportador los
  regenera/descarga localmente.
- Sin microdatos personales en el corpus (verificado: solo agregados oficiales).
- Sin secretos en el repo (verificado: sin `.env`/claves; solo rutas en informe).

## Dependencias con aviso (auditoría 2026-10-16)

- `echarts <6.1.0` (moderate XSS): solo subsanable con major breaking; exposición real
  nula (opciones construidas con datos estáticos locales, sin HTML de usuario).
- `postcss` anidado en `next` (high, build-time): solo subsanable con Next 16 (breaking);
  sin exposición en runtime. Reevaluar en upgrades planificados, no de urgencia.
