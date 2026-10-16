# Catálogo de fuentes — FASE 4

Detalle máquina: `reports/tables/phase4/source_coverage.csv`. Descargas reales en
`data/raw/ine_*.csv` (SHA-256 en el CSV; constatados 25,7 + 121 + 0,1 + 0,3 + 2,9 MB).
Licencia: datos INE reutilizables **CC BY 4.0 citando al INE**; compilación propia con
atribución en cada gráfico/tabla.

| Fuente | Indicador | Cobertura | Estado ML | Motivo |
|---|---|---|---|---|
| INE 36780 (padrón edad) | bandas 18–29/30–44/45–64/65+, extranjería | 1-ene 2003–2022, 52 prov | `usable_for_ML` | vintage año < elección |
| INE 2852 (pob. total) | población total | 1996–2021 | `usable_for_ML` | + fallback último ≤ vintage; EDA comparativa |
| INE 72989 (EPA) | paro/actividad/empleo | 2002T1–2026T2 trim. | `usable_for_ML` | último trim. con fin+45d < elección; 1 celda `..` |
| INE 53687 (ADRH) | % renta por fuente (5) | 2015–2023 | `usable_for_ML` | ref ≤ año−2 (**asumido**, verificar); forales incompletos |
| INE 67217 (censo edad) | bandas de edad | 2021–2025 | `EDA_only` | solo solapa 2023 (n=1) |
| CIS barómetros/FID | estimación + microdatos | — | `blocked` | HTTP 200 pero sin transcripción automática sin autorización; PENDING |

Conceptos no mezclados: residente (padrón/censo) ≠ elector (censo CER+CERA) ≠ votante;
% renta por fuente ≠ renta neta per cápita; paro EPA ≠ paro registrado;
`direct_intention` ≠ `estimated_vote`.
