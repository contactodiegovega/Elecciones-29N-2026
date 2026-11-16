import Link from "next/link";

const sections = [
  { href: "/historico", title: "Historia electoral · PP y PSOE", desc: "Compara voto, escaños y participación en las generales desde 1977. Explora las series de PP y PSOE y de las demás formaciones.", meta: "1977–2023" },
  { href: "/participacion", title: "Participación", desc: "Cuánto se vota y cómo cambia la participación entre territorios y elecciones.", meta: "52 circunscripciones" },
  { href: "/demografia", title: "Demografía y territorio", desc: "Edad, renta y población: contexto descriptivo de las diferencias provinciales.", meta: "Datos del INE" },
  { href: "/laboratorio-ml", title: "Laboratorio estadístico", desc: "Modelos retrospectivos, backtesting, errores y comparación con referencias sencillas.", meta: "Investigación histórica" },
  { href: "/metodologia/modelos", title: "Registro de experimentos", desc: "Versiones, métricas y límites de los modelos de participación conservados en el proyecto.", meta: "Archivo técnico" },
  { href: "/metodologia", title: "Metodología y fuentes", desc: "Procedencia de los datos, reglas matemáticas, licencias y límites de cada análisis.", meta: "Trazabilidad" },
  { href: "/territorio", title: "Atlas histórico", desc: "Mapas por elección: participación, abstención y voto de cada partido.", meta: "Exploración territorial" },
  { href: "/partidos", title: "Catálogo de candidaturas", desc: "Formaciones, etiquetas originales, familias políticas y registro de colores.", meta: "Identidades históricas" },
];

export default function Aprende() {
  return <div className="mx-auto max-w-4xl space-y-9">
    <section><p className="eyebrow">Una guía breve</p><h1 className="mt-2 text-4xl font-bold">Aprende más</h1><p className="mt-3 text-lg text-stone-600">Las claves para interpretar los diputados y los escenarios.</p><Link className="mt-4 inline-block text-sm font-semibold text-accent underline" href="/#dhondt">D’Hondt en tres pasos, con un ejemplo real →</Link></section>
    <section className="border-t border-line pt-7"><h2 className="text-2xl font-bold">¿Por qué importa la provincia?</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">No hay un único reparto nacional. Cada provincia tiene sus diputados y su propio reparto. Un porcentaje nacional no dice cuántos diputados obtiene una candidatura en una provincia.</p><p className="mt-3 text-sm leading-relaxed text-stone-600">La barrera legal es el 3 % de los votos válidos de esa circunscripción: el blanco cuenta; el nulo no. En Ceuta y Melilla, que eligen un diputado, gana la candidatura más votada.</p><Link className="mt-3 inline-block text-sm text-accent underline" href="/provincias">Consultar la asignación provincial →</Link></section>
    <section className="border-t border-line pt-7"><h2 className="mb-4 text-2xl font-bold">Preguntas frecuentes</h2>
      {[
        ["¿Qué es el último escaño?", "El diputado adjudicado al menor de los cocientes que entran en el reparto provincial. El siguiente cociente queda fuera."],
        ["¿Cuántos votos hacen falta para un diputado?", "No existe una cifra fija. Depende de los votos de todas las candidaturas, el blanco y los escaños de esa provincia. La calculadora lo comprueba manteniendo constantes los demás votos."],
        ["¿Qué significa mayoría absoluta?", "Más de la mitad de los diputados. En el Congreso, con 350 escaños, son 176."],
        ["¿Por qué cada provincia elige distintos diputados?", "El Congreso tiene 350 diputados. Cada provincia recibe un mínimo de dos y el resto se distribuye según la población; Ceuta y Melilla eligen uno cada una. En esta herramienta usamos la asignación de la elección histórica mostrada."],
        ["¿Cómo interpretar un escenario hipotético?", "Es una comparación matemática con 2023: añadir votos aumenta el total válido; transferirlos conserva ese total. Editarlos libremente recalcula todo el reparto. Ningún supuesto expresa una probabilidad ni anticipa unas elecciones futuras."],
        ["¿Por qué puede haber votos y ningún escaño?", "Porque no se supera el 3 % legal o porque, incluso superándolo, los cocientes de otras candidaturas ocupan todos los puestos disponibles."],
        ["¿Una diferencia de cocientes equivale a votos?", "No. Se comparan votos divididos por números distintos. Para calcular un cambio hay que volver a repartir todos los escaños."],
      ].map(([q, a]) => <details key={q} className="border-b border-line py-4"><summary className="cursor-pointer text-sm font-semibold">{q}</summary><p className="mt-3 text-sm leading-relaxed text-stone-600">{a}</p></details>)}
    </section>
    <details className="advanced-fold"><summary>Fuentes, histórico y recursos técnicos</summary><ul className="mt-4 space-y-3">{sections.map(s => <li key={s.href}><Link href={s.href} className="text-sm font-medium text-accent underline">{s.title}</Link><p className="mt-1 text-xs text-stone-500">{s.desc}</p></li>)}</ul></details>
    <a href="https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672#a163" target="_blank" rel="noreferrer" className="inline-block text-sm text-accent underline">Consultar las reglas en la LOREG ↗</a>
  </div>;
}
