import Link from "next/link";
import { Card, Provenance, SectionTitle, Tag } from "@/components/ui";

export default function Metodologia() {
  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Transparencia"
        title="Metodología: cómo se hacen los datos"
        desc="Cómo se construyó El Último Escaño, qué mide cada cifra y cómo se reproduce. Todo dato procede de un artefacto versionado; ningún hueco se rellena a ojo."
        sources={["Datos abiertos", "Pipeline por fases", "Tests automáticos"]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Fuentes y licencias">
          <ul className="space-y-3 text-sm leading-relaxed text-stone-700">
            <li>
              <strong>Ministerio del Interior.</strong> Resultados de elecciones al Congreso 1977–2023,
              uso público oficial. Base de votos, escaños, censo y participación.
            </li>
            <li>
              <strong>INE.</strong> Padrón, EPA, proyecciones y ADRH. Licencia <strong>CC BY 4.0</strong>,
              citando al INE. Tablas 36780, 67988, 2852, 72989, 53687 y 67217.
            </li>
            <li>
              <strong>Compilación de encuestas (Wikipedia).</strong> <strong>CC BY-SA 4.0</strong> con atribución
              (revisiones 1380368158 y 1375363334). No transfiere permisos de las fuentes primarias.
            </li>
            <li>
              <strong>Eurostat GISCO NUTS 2021.</strong> Geometría provincial, © EuroGeographics.
              Las islas se agregan a su provincia.
            </li>
            <li>
              <strong>BOE y LOREG.</strong> Calendario electoral y artículo 69.7 sobre la veda de sondeos.
            </li>
          </ul>
        </Card>

        <Card title="Definiciones">
          <dl className="space-y-3 text-sm leading-relaxed text-stone-700">
            <div><dt className="font-semibold text-ink">Cuota de voto (%)</dt><dd>Votos de la formación / votos a candidaturas del mismo ámbito. No incluye nulos ni blancos salvo que se indique.</dd></div>
            <div><dt className="font-semibold text-ink">Cambios</dt><dd>Los cambios de cuota o participación se expresan en puntos porcentuales (pp). Los controles «Todas ±5 %» del escenario son cambios relativos de votos, redondeados a enteros.</dd></div>
            <div><dt className="font-semibold text-ink">Participación</dt><dd>Votantes / electores. Censo, padrón, votantes y habitantes son universos distintos.</dd></div>
            <div><dt className="font-semibold text-ink">Renta ADRH</dt><dd>Peso de cada fuente de ingreso sobre la renta de los hogares, no renta per cápita.</dd></div>
            <div><dt className="font-semibold text-ink">EPA</dt><dd>Encuesta de población activa: no es paro registrado ni una medición censal.</dd></div>
            <div><dt className="font-semibold text-ink">Vintage</dt><dd>Versión de la fuente utilizable en la fecha de corte. Los nulos se justifican; no se hace forward-fill.</dd></div>
            <div><dt className="font-semibold text-ink">Estimación vs intención</dt><dd>Universos distintos. Jamás se promedian ni se dibujan en la misma serie.</dd></div>
          </dl>
        </Card>

        <Card title="Normalización y color">
          <ul className="space-y-2 text-sm leading-relaxed text-stone-700">
            <li>1.778 etiquetas originales se conservan intactas; 479 se mapean a 36 partidos mediante reglas versionadas.</li>
            <li>Las confluencias no se fuerzan: Podemos/IU, UCD/AP/PP y las coaliciones territoriales mantienen identidad propia cuando la fuente no permite separarlas.</li>
            <li>El color sale del registro central (PP azul, PSOE rojo, VOX verde). El fallback determinista se identifica en la tabla de verificación.</li>
            <li>Los colores distinguen series; no son una valoración política.</li>
          </ul>
          <Provenance items={["taxonomy.json 2026-10-16.v1", "colors.json", "Sin fusiones silenciosas"]} />
        </Card>
      </div>

      <Card title="El último escaño: reconstrucción y escenarios" subtitle="Candidaturas originales, sin agregación por familia política">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
          <li>Lee todas las candidaturas de 2023, sus votos y sus escaños oficiales de <code>labels_by_election/2023-07-23.json</code>. El censo, la participación y el voto en blanco proceden de <code>turnout.json</code>.</li>
          <li>Conserva listas distintas por separado. El umbral provincial del 3 % se calcula sobre votos a candidaturas más votos en blanco; excluye los nulos.</li>
          <li>Ordena cocientes mediante productos cruzados, sin usar el redondeo mostrado en pantalla para decidir el escaño. A igualdad de cociente prima el total de votos. El empate exacto de votos en el corte se marca como pendiente de sorteo.</li>
          <li>Recalcula con los escaños de 2023 y compara cada candidatura con los escaños oficiales almacenados en las 52 circunscripciones. Ceuta y Melilla se resuelven por mayoría.</li>
          <li>El último cociente adjudicado y el primero no adjudicado explican el corte. Su diferencia no es un número de votos necesarios: depende de los divisores y del escenario.</li>
          <li>Los escenarios editan votos enteros de cualquier candidatura y el blanco. La asignación de 2026 es una opción explícita: los resultados de 2023 mantienen su asignación histórica. Reutilizar candidaturas históricas no presupone su participación futura.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-accent"><Link className="underline" href="/ultimo-escano">Abrir herramienta y auditoría</Link><a className="underline" href="https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907">Resultados JEC 2023</a><a className="underline" href="https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-20742">Asignación oficial 2026</a></div>
      </Card>

      <Card title="Laboratorio: simulador nacional avanzado" subtitle="Swing territorial y agrupaciones explícitas; herramienta distinta de la reconstrucción histórica">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
          <li>Parte de los porcentajes nacionales de 2023 y del patrón provincial del Ministerio del Interior.</li>
          <li>Aplica un <strong>swing aditivo uniforme</strong> a cada partido: cuota provincial nueva = cuota provincial 2023 + (cuota nacional nueva − cuota nacional 2023), truncada en cero y renormalizada.</li>
          <li>Convierte cuotas en votos con los votos válidos provinciales y el cambio de participación elegido.</li>
          <li>Aplica el <strong>umbral del 3 %</strong> por circunscripción y reparte con <strong>D&apos;Hondt</strong> los escaños de cada provincia (1 en Ceuta y Melilla).</li>
          <li>La sensibilidad diferencial es un supuesto explícito y desactivado por defecto: con 0, un cambio uniforme de participación no altera el reparto.</li>
          <li>La validación histórica usa las candidaturas originales, no la base nacional agregada. La base agregada puede alterar repartos (por ejemplo, al reunir NC-bc y CCa). Consulta la nueva herramienta provincial para reconstruir el resultado real.</li>
        </ol>
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>No modela</strong> pactos postelectorales, investidura, coaliciones de gobierno, voto útil
          estratégico, campaña ni incertidumbre muestral. Los escaños son hipotéticos.
        </div>
        <Provenance items={["simulator.json", "Validación 350/350 y 0 discrepancias", "Umbral legal por circunscripción"]} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Encuestas: límites de la fuente">
          <ul className="space-y-2 text-sm leading-relaxed text-stone-700">
            <li>La compilación no trae <strong>fecha de publicación verificada</strong> (<code>published_at</code> es nulo). Por eso el eje temporal usa el <strong>fin de trabajo de campo</strong> y se dice explícitamente.</li>
            <li>El panel de snapshots diarios de campaña está desactivado: construir «qué se sabía cada día» con fechas de campo mezclaría medición y difusión.</li>
            <li>Las réplicas y actualizaciones de tracking se marcan; no cuentan como observaciones independientes.</li>
            <li>La mediana móvil describe el centro de las mediciones, no anticipa el resultado.</li>
            <li>Ningún agregado se presenta como intervalo de probabilidad del resultado electoral.</li>
          </ul>
          <Provenance items={["publication_status.json", "poll_sources.json", "1.533 sondeos, 37 casas, 0 fechas de publicación verificadas"]} />
        </Card>

        <Card title="Compuerta de calidad y ML">
          <Link href="/metodologia/modelos" className="mb-4 inline-block text-sm font-medium text-accent underline">Consultar el registro de experimentos y versiones →</Link>
          <div className="flex flex-wrap gap-2">
            <Tag tone="warn">Corrector de encuestas: NO-GO</Tag>
            <Tag tone="warn">Proyección de participación: NO-GO</Tag>
            <Tag tone="warn">Proyección por partido 2026: NO-GO</Tag>
            <Tag tone="warn">Proyección pública: no permitida</Tag>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone-700">
            El baseline <code>mean3</code> sigue ganando con 3,563 pp de MAE macro. Los modelos enriquecidos
            de fase 4 no demuestran superioridad con solo seis elecciones retenidas. La fuga temporal de
            tres columnas se corrigió desplazándolas a pasado estricto. Un corrector de encuestas requeriría
            al menos tres elecciones etiquetadas; solo hay una.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            Productos permitidos: agregado descriptivo de encuestas, simulador hipotético, backtesting
            retrospectivo y metodología. Prohibidos: pronóstico de ganador, probabilidad calibrada de
            victoria y proyección provincial presentada como resultado esperado.
          </p>
          <Provenance items={["ml_gate.json", "ml.json", "n = 6 elecciones de test, no 52 provincias independientes"]} />
        </Card>
      </div>

      <Card title="Reproducibilidad" subtitle="Pipeline Python + exportador JSON + tests">
        <p className="text-sm leading-relaxed text-stone-700">
          El repositorio contiene el pipeline por fases en <code>src/electoral/</code>, los tests en
          <code> tests/</code>, los contratos de datos en <code>web/lib/types.ts</code> y los artefactos
          servidos en <code>web/public/data/</code>. Las cifras de la web se leen de esos artefactos; no
          se teclean a mano en los componentes.
        </p>
        <pre className="mt-3 overflow-auto rounded-lg bg-ink p-4 text-xs leading-relaxed text-paper">
{`# Desde la raíz del repositorio (PowerShell)
python -m pytest tests -q          # tests del pipeline
python -m src.electoral.export_web # regenera web/public/data

cd web
npm run typecheck
npm run lint
npm run test
npm run build`}
        </pre>
        <p className="mt-3 text-sm text-stone-600">
          La app se exporta como sitio estático (<code>next build</code> con <code>output: &quot;export&quot;</code>),
          así que todas las páginas funcionan sin servidor de datos. Los gráficos se montan en cliente y
          los fallos de carga se muestran explícitamente en lugar de dejar un lienzo vacío.
        </p>
        <Provenance items={["pytest", "vitest", "TypeScript estricto", "Build estático"]} />
      </Card>

      <Card title="Accesibilidad y lectura" subtitle="Decisiones de presentación">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
          <li>Cada gráfico tiene descripción textual (<code>aria-label</code>) y los datos se pueden exportar a CSV.</li>
          <li>Las tablas conservan encabezados, leyendas y unidades; nunca se depende solo del color.</li>
          <li>Los mensajes de error y de carga usan <code>role=&quot;status&quot;</code> o <code>role=&quot;alert&quot;</code>.</li>
          <li>Los cambios se expresan en puntos porcentuales y se indica cuándo dos perímetros no son comparables.</li>
          <li>El diseño respeta <code>prefers-reduced-motion</code> mediante transiciones discretas y sin animaciones de fondo.</li>
        </ul>
        <Provenance items={["Contraste revisado sobre paper/ink", "Navegación por teclado", "Exportación CSV con BOM para Excel"]} />
      </Card>

      <p className="text-sm text-stone-600">
        Volver a la <Link href="/" className="underline hover:text-accent">portada</Link> o revisar el
        <Link href="/laboratorio-ml" className="underline hover:text-accent"> laboratorio ML</Link>.
      </p>
    </div>
  );
}
