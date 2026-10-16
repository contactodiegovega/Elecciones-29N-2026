# Fuentes oficiales — auditoría FASE 1

Fecha de consulta: 2026-10-16 (UTC). Detalle verificable en `data/processed/source_audit.csv`.
No se registra éxito sin descarga real. Ningún enlace de los 6 falló (ver matiz TLS abajo).

## Descargas reales (2)

| ID | Proveedor | URL | Fichero | Bytes | SHA-256 | TLS |
|---|---|---|---|---|---|---|
| `interior_congreso_xlsx` | Ministerio del Interior | https://descargas.interior.gob.es/datasets/resultados_electorales/Elecciones-Congreso.xlsx | `data/raw/Elecciones-Congreso.xlsx` | 1 151 199 | `dba3394f1812f338067231bce68acf56af1e13ddf8cfb709a814bcc46357ebc2` | ⚠️ fallback sin verificación (ver nota) |
| `ine_poblacion_67988` | INE | https://www.ine.es/jaxiT3/files/t/csv_bdsc/67988.csv | `data/raw/ine_67988_poblacion_provincial.csv` | 67 892 | `7c6ec6ba18d69a782617f9c66505892649a6280cd7bca18c0afee47a273995e5` | estricta OK |

**Nota TLS (Interior):** el host `descargas.interior.gob.es` responde HTTP 200, pero la cadena
de certificados no la verifica el almacén de CA del Python del entorno
(`SSLCertVerificationError`). Tras fallar la verificación estricta se descargó con
`verify=False` y se dejó constancia en `source_audit.csv` (columna `ssl_mode`). Integridad
constatada por tamaño (`Content-Length: 1151199` anunciado = bytes recibidos) y SHA-256
registrado. En un entorno con CA del sistema al día debería funcionar la verificación estricta.

## Verificación HEAD / contexto (4, sin descarga binaria)

| ID | URL | Estado |
|---|---|---|
| `datos_gob_catalogo` | https://datos.gob.es/es/catalogo/e00003801-resultados-electorales | 200 |
| `infoelectoral_descargas` | https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/ | 200 |
| `ine_datosabiertos` | https://www.ine.es/datosabiertos/ | 200 |
| `boe_2026_contexto` | https://boe.es/diario_boe/txt.php?id=BOE-A-2026-20742 | 200 (solo contexto de convocatoria; NO contiene resultados) |

## Cobertura constatada (inspección real, no supuesta)

- **Excel Interior**: 1 hoja (`Congreso`), 6 203 filas de datos, 57 columnas
  (Fecha, Código Elección, Tipo Elección, Descripción + 52 circunscripciones + `Total Escaños Nacional`).
  16 comicios 1977-06-15 → 2023-07-23. Formato ancho: filas = (elección × indicador/candidatura),
  columnas = provincias (`NN - Nombre`). Sin resultados del 29N-2026 (correcto: aún no existen).
- **INE 67988**: CSV con `;`, UTF-8 con BOM; columnas `Total Nacional; CCAA; Provincias; Sexo; Periodo; Total`.
  Cobertura **solo 2021–2025** (5 años), niveles nacional + autonómico + provincial (52),
  desglose por sexo (Total/Hombres/Mujeres). **No sirve como serie histórica 1977–2020.**
- **Conceptos distintos, no mezclar**: población (INE, residentes totales) ≠ censo/electores
  (Interior, con derecho a voto, CER + CERA) ≠ votantes/votos.

## Licencias

Datos de uso público oficial. Condiciones exactas en las webs de cada proveedor
(Ministerio del Interior, INE, datos.gob.es, BOE). No se redistribuyen ficheros con
restricciones conocidas; los brutos se conservan sin modificar en `data/raw/`.
