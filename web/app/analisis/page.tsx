import Link from "next/link";
import { LinkCard, Notice, SectionTitle } from "@/components/ui";

const ANALYSES = [
  { href: "/historico", title: "Histórico", desc: "Dieciséis elecciones generales: voto, cuota, escaños y participación, con series comparables.", meta: "1977–2023" },
  { href: "/participacion", title: "Participación", desc: "Quién vota, cuánto y dónde. Serie nacional, mapa provincial y cambios entre elecciones.", meta: "52 provincias" },
  { href: "/demografia", title: "Demografía", desc: "Relación entre edad, extranjería, renta y voto. Correlación descriptiva, no causalidad.", meta: "15 elecciones" },
  { href: "/laboratorio-ml", title: "Laboratorio de modelos", desc: "Backtest retrospectivo, errores por elección, ablaciones y auditoría de fuga temporal.", meta: "6 folds" },
  { href: "/simulador", title: "Simulador D'Hondt", desc: "Reparte los 350 escaños con las reglas reales a partir de los porcentajes que tú elijas.", meta: "Hipotético" },
  { href: "/metodologia", title: "Metodología y fuentes", desc: "Qué datos entran, cómo se limpian, qué se excluye y qué límites tiene cada sección.", meta: "Fuentes y licencias" },
];

const LEGACY = [
  { href: "/territorio", title: "Territorio", desc: "Mapa provincial con ficha histórica por circunscripción. Versión anterior, aún disponible." },
  { href: "/campana", title: "Campaña", desc: "Sondeos durante la campaña y evolución por casa. Versión anterior, aún disponible." },
  { href: "/partidos", title: "Partidos", desc: "Catálogo de formaciones, colores y mapeo de candidaturas. Versión anterior, aún disponible." },
];

export default function Analisis() {
  return (
    <div className="space-y-7">
      <SectionTitle
        kicker="Más análisis"
        title="Todo lo demás, con contexto"
        desc="Secciones de apoyo para entender los datos: historia, participación, demografía, modelos retrospectivos y reglas del reparto. Ninguna produce un pronóstico del 29N."
        sources={["Datos oficiales y compilaciones citadas", "Cada sección declara sus límites"]}
      />

      <Notice title="Qué tienen en común" tone="info">
        Todas las secciones separan <strong>dato observado</strong>, <strong>herramienta hipotética</strong> y{" "}
        <strong>modelo experimental</strong>. Cuando algo no se puede calcular con honestidad, se muestra como
        «no disponible» y se explica por qué.
      </Notice>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {ANALYSES.map((a) => <LinkCard key={a.href} {...a} />)}
      </div>

      <section>
        <h2 className="font-serif text-2xl text-ink">Versiones anteriores</h2>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">
          Estas páginas conservan exploraciones más técnicas. No compiten en la navegación principal, pero siguen
          enlazadas para no romper enlaces ni eliminar funcionalidad.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {LEGACY.map((a) => <LinkCard key={a.href} {...a} meta="Archivo" />)}
        </div>
      </section>

      <p className="text-sm text-stone-600">
        ¿Buscas los escaños que se eligen en cada provincia?{" "}
        <Link href="/diputados" className="font-medium text-accent underline underline-offset-2">Ver diputados por provincia</Link>.
      </p>
    </div>
  );
}
