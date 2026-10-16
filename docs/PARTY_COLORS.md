# Guía cromática electoral (FASE 2, para gráficos y futura web)

Fuente central: `config/party_colors.json` (v2026-10-16.v1, 36 partidos).
Exportación de solo lectura: `data/processed/party_colors.json` (vía `colors.py`).
Función: `get_party_color(party_id, election_date=None) -> (hex, origen)` en
`src/electoral/colors.py`; respeta vigencia (`valid_from/valid_to`) y usa reserva
determinista (hash md5 → paleta neutra; estable entre ejecuciones, nunca aleatoria).

## Regla innegociable (verificada por test de tono, no por HEX exacto)

| Partido | HEX | Tono |
|---|---|---|
| **PP** | `#1B5FCC` | **azul** |
| **PSOE** (incl. PSC/PSdeG/PSE-EE/PSIB/PSN) | `#E30613` | **rojo** |
| **VOX** | `#5CB531` | **verde** |

Ningún HEX se declara "oficial" salvo que el partido lo publique: `representative` =
tono corporativo reconocible (web del partido como fuente); `provisional` = asignado
para distinguir, pendiente de verificar. Ver columna `verification_status` y `source_url`
por partido en el JSON.

## Otros relevantes

| Partido | HEX | Estado | | Partido | HEX | Estado |
|---|---|---|---|---|---|---|
| Sumar | `#D6006D` | representative | | PACMA | `#78A22F` | representative |
| Podemos | `#6A1B9A` | representative | | Cs | `#F39200` | representative |
| IU | `#009444` | representative | | CUP | `#C8102E` | representative |
| ERC | `#F5B800` | representative | | UPyD | `#E4007C` | provisional |
| Junts | `#00A9CE` | representative | | UCD/AP/CDS/PCE | ver JSON | prov./repr. |
| PNV | `#00693C` | representative | | CiU/HB/PA/UV/PAR/EA/EE/IC/PSUC/FN/CDC/DL | ver JSON | provisional |
| BILDU | `#AACC26` | representative | | UPN-PP/NAMAS (coaliciones) | propio | provisional |
| BNG | `#009FE3` | representative | | Compromís | `#E87722` | representative |
| CC | `#FFE500` | representative | | Candidaturas sin partido | paleta neutra + etiqueta "color pendiente" | fallback |
| UPN | `#7A003C` | representative | | | | |

## Normas de uso (también para React)

1. Mismo partido → mismo color en votos, % y escaños; la métrica se distingue por
   eje/tipo de gráfico/anotación, nunca cambiando el color.
2. Tonos próximos (verdes VOX/IU/PNV/PACMA; rojos PSOE/CUP/PCE/PAR; azules PP/CIU/CDC/BNG;
   amarillos ERC/CC; magentas Sumar/UPyD/EE; naranjas Cs/Compromís/UV) se distinguen ADEMÁS
   por marcador, grosor, etiqueta directa o panel separado. El color nunca es el único canal.
3. Las coaliciones (UPN-PP, Navarra Suma, CiU, DL…) no heredan color de sus integrantes.
4. Contraste sobre fondo claro verificado visualmente en las figuras exportadas; para fondo
   oscuro futuro, aclarar neutros y comprobar razón de contraste antes de publicar.
