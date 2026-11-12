# Baseline de reenfoque — Observatorio Electoral 29N

Fecha de auditoría: 2026-11-12 (Europe/Madrid)
Rama: `main` · último commit auditado: `58e5406 Create package-lock.json`
Estado Git al iniciar: limpio salvo el documento de instrucciones sin seguimiento.

## 1. Estado técnico comprobado

| Comprobación | Resultado real |
|---|---|
| `python -m pytest tests/ -q` | **53 passed** (35,31 s) |
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm test` (Vitest) | **8 passed** |
| `npm run build` | **FALLA** por `robots.ts` con `output: "export"` (`export const dynamic` no configurado). Es un defecto preexistente, no causado por este reenfoque. Se corregirá en el Paso 7. |

## 2. Recuentos verificados sobre los artefactos actuales

| Dato | Valor verificado | Fuente local |
|---|---|---|
| Elecciones generales | 16 (1977-06-15 → 2023-07-23) | `elections.parquet`, `results_national.json` |
| Etiquetas originales de candidatura | 1.778 | `candidacy_party_mapping.parquet` |
| Partidos normalizados | 36 | `party_registry.parquet` |
| Provincias/circunscripciones | 52 | `territories.parquet` |
| Escaños totales 2023 | 350 (suma provincial = 350) | `election_results.parquet` |
| Encuestas totales | 1.232 | `polls.parquet` |
| Encuestas `estimated_vote` | 832 | `polls.parquet` |
| Encuestas `direct_intention` | 400 | `polls.parquet` |
| Casas/encuestadoras | 36 | `polls.parquet` |
| Estimaciones por partido | 12.945 | `poll_estimates.parquet` |
| Encuestas con campo ≥ 2023-07-23 (ciclo 2026) | 722 | `polls.parquet` |
| Encuestas con campo en 2026 | 193 | `polls.parquet` |
| Último fin de campo disponible | 2026-10-11 | `polls.parquet` |
| `retrieved_at` de la compilación de encuestas | 2026-10-16 | `polls.parquet`, `polls_audit.csv` |

Cobertura de mapeo en 2023: 98,56 % de votos; 353.755 votos sin partido asignado
(etiquetas conservadas). No se pierde ninguna etiqueta al filtrar PP/PSOE solo en la UI.

## 3. Fuentes y licencias presentes

- **Ministerio del Interior**: resultados oficiales Congreso (uso público oficial).
- **INE**: tablas 67988/36780/2852/72989/53687/67217 (CC BY 4.0, citar INE).
- **Wikipedia**: compilación de encuestas (CC BY-SA 4.0, atribución; revisiones
  1380368158 y 1375363334). No transfiere permisos de las fuentes primarias.
- **Eurostat GISCO NUTS 2021**: geometría (©EuroGeographics, atribución).

## 4. Riesgos y límites detectados

1. **Sin encuestas nuevas tras 2026-10-11.** El corpus actual no contiene campo
   posterior ni publicaciones de campaña (13–27 de noviembre de 2026). No se debe
   fabricar ninguna incorporación.
2. **`published_at` desconocido** en la compilación: los cortes temporales usan
   `fieldwork_end`. Se mantendrá `fecha_publicacion_desconocida` explícita.
3. **Build estático roto** por `robots.ts` (ver §1).
4. **Dataset de encuestas con resultado etiquetado**: prácticamente una sola
   elección general (2023); insuficiente para validar un corrector fuera de muestra.
5. **ML**: el baseline `mean3` (MAE macro 3,56 pp) sigue ganando; no hay evidencia
   para publicar pronósticos del 29N.
6. **Veda legal LOREG 69.7**: 24–28 de noviembre de 2026. Debe implementarse un
   guardián fail-closed en Europe/Madrid.
7. **AP ≠ PP**: Alianza Popular no puede dibujarse como PP antes de 1989.
8. **Doble lockfile** (`package-lock.json` raíz y `web/`) provoca warning de Next;
   se documenta y se evita modificar el comportamiento sin revisión.

## 5. Decisiones de continuidad

- No se elimina ningún dataset, experimento, ruta ni etiqueta.
- El filtro PP/PSOE es **solo de visualización** en `/historico`.
- `data/raw/*` está ignorado por Git; los artefactos procesados sí están versionados.
- Cualquier nueva encuesta deberá entrar por el esquema canónico, con fuente,
  fechas, licencia, hash y revisión; si faltan datos quedará `pending_review`.
- Los snapshots de campaña serán inmutables y fechados.

## 6. Checkpoint

Commit de seguridad de este baseline antes de cualquier cambio funcional.
