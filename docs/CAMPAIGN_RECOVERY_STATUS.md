# Estado de recuperación del observatorio

El reenfoque está **en desarrollo; no está listo para publicar**.

## Avances

- Se preservó el trabajo anterior en el commit de recuperación `265e3e9`.
- La serie principal histórica se limita a PP y PSOE; AP no se presenta como PP antes de 1989.
- Las reconstrucciones de campaña exigen fecha de publicación conocida, además de fin de campo anterior al corte. La compilación actual no aporta fechas de publicación suficientes, por lo que no se atribuye retrospectivamente disponibilidad pública a los sondeos.
- Se corrigió la interpretación de rangos de campo que cruzan el año: el año indicado corresponde al final del rango.
- D'Hondt reproduce las 350 actas de 2023 con las candidaturas originales; esto no valida la distribución hipotética por partidos del simulador.
- Existe una vista inicial `/campana` que informa de la ausencia de datos temporalmente verificables.

## Bloqueos para considerar terminado el producto

- El simulador aún no tiene interfaz interactiva; su agregación por partido agrupa candidaturas y no acredita el reparto de escenarios territoriales. Debe revisarse antes de su uso público.
- Una exportación estática generada antes de la veda conserva JSON accesibles directamente. El guardián Python solo protege exportaciones generadas durante la veda; **no garantiza la retirada de un sitio ya publicado**. Se necesita infraestructura que retire o restrinja los archivos y sus copias/cachés durante la veda. No desplegar hasta resolverlo.
- Los ficheros anteriores de `data/processed/campaign/snapshots/` fueron calculados con fin de campo como sustituto de publicación; no son evidencia de lo conocido en cada fecha. Se conservan para recuperación, pero no deben publicarse ni utilizarse como snapshots verificados. Los nuevos se escriben en `snapshots_verified_publication/`.
- Las fuentes de la compilación son secundarias; no se ha verificado individualmente cada sondeo en su publicación primaria.
- Faltan automatización de actualización resiliente, documentación final, pruebas de navegación visual y cobertura integral de las nuevas funcionalidades.

## Comprobaciones realizadas en esta recuperación

- `python -m pytest tests/test_campaign_refocus.py -q`: 4 pruebas aprobadas.
- `python src/electoral/simulator.py --validate-only`: 350 escaños y cero discrepancias para candidaturas originales de 2023.
- `npm run lint`, `npm run typecheck` y `npm test`: correctos (8 pruebas web); lint y tipado repetidos tras añadir la vista de campaña.
- `npm run build`: Next informó compilación y exportación correctas antes de añadir la vista de campaña, pero el proceso no terminó dentro del límite del entorno; falta repetirlo para el estado final.
- `python -m pytest tests/ -q`: excedió el límite de 300 segundos; no se considera aprobado.
