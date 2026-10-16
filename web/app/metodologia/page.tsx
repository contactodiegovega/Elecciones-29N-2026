import { Provenance, SectionTitle } from "@/components/ui";

export default function Metodologia() {
  return (
    <div>
      <SectionTitle kicker="Transparencia" title="Metodología y reproducibilidad"
        desc="Cómo se construyó este observatorio, qué mide cada cifra y qué no afirma." />
      <div className="space-y-4 text-sm leading-relaxed text-stone-700">
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-serif text-xl text-ink">Fuentes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Ministerio del Interior</strong> (resultados Congreso 1977–2023, uso público oficial).</li>
            <li><strong>INE</strong>, tablas 67988/36780/2852/72989/53687/67217 — <strong>CC BY 4.0, citando al INE</strong>.</li>
            <li><strong>Compilación de encuestas (Wikipedia)</strong> — <strong>CC BY-SA 4.0 con atribución</strong> (revs 1380368158/1375363334); no transfiere permisos de las fuentes primarias.</li>
            <li><strong>Eurostat GISCO NUTS 2021</strong> (geometría, ©EuroGeographics, con atribución; islas agregadas a provincia).</li>
          </ul>
        </section>
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-serif text-xl text-ink">Definiciones (unidades separadas)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Cuota de voto (%):</strong> votos / votos a candidaturas del mismo ámbito.</li>
            <li><strong>Cambios</strong> en <strong>puntos porcentuales (pp)</strong>, nunca en %.</li>
            <li><strong>Participación:</strong> votantes / electores. <strong>Censo ≠ padrón ≠ votantes ≠ habitantes.</strong></li>
            <li><strong>Renta ADRH:</strong> % por fuente de ingreso (no per cápita). <strong>EPA:</strong> encuesta (no paro registrado).</li>
            <li><strong>Estimación de voto ≠ intención directa</strong>: universos distintos, jamás promediados.</li>
            <li><strong>Vintage:</strong> referencia utilizable porque se publicó antes del corte; nulos justificados, sin forward-fill.</li>
          </ul>
        </section>
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-serif text-xl text-ink">Normalización y colores</h2>
          <p className="mt-2">1.778 etiquetas originales intactas; 479 mapeadas a 36 partidos con reglas
            explícitas versionadas (confluencias Podemos/IU y UCD/AP/PP nunca fusionadas).
            Colores del registro central (PP azul, PSOE rojo, VOX verde); provisionales y
            fallback identificados. Fecha de corte de datos: 2026-10-16.</p>
        </section>
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-serif text-xl text-ink">Por qué no hay pronósticos</h2>
          <p className="mt-2">El ML es evaluación <strong>retrospectiva</strong> (n=6 elecciones de test;
            52 provincias correlacionadas por ciclo). El baseline <code>mean3</code> (3,56 pp macro)
            sigue ganando: no hay superioridad demostrada. Con una sola elección etiquetada con
            encuestas (2023) no se valida ningún corrector prospectivo. Las encuestas son
            fotografías fechadas, no recomendaciones.</p>
        </section>
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="font-serif text-xl text-ink">Reproducibilidad</h2>
          <p className="mt-2">Pipeline Python por fases + exportador a JSON versionados; 53 tests;
            semillas fijas. Comandos en el README del repositorio (PowerShell).</p>
        </section>
      </div>
      <Provenance items={["Documentación verificable: docs/ del repositorio", "Sin cifras no comprobadas"]} />
    </div>
  );
}
