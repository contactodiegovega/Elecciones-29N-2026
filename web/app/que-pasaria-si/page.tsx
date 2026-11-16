import ContextualExplorer from "@/components/ContextualExplorer";
import leon from "@/public/data/provinces/24.json";
import provinces from "@/public/data/provinces/index.json";
import { ProvinceDataSchema } from "@/lib/province";
import history from "@/public/data/scenario_history/24.json";
import { HistorySchema } from "@/lib/contextual-scenarios";

export default function ScenariosPage() {
  return <div className="space-y-7"><header className="hero-editorial"><p className="eyebrow">Historia observada · supuestos transparentes</p><h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">¿Qué pasaría si <span className="text-accent">cambiaran los votos?</span></h1><p className="mt-4 max-w-3xl text-base leading-relaxed text-stone-600">Compara lo que cambió entre las elecciones oficiales de noviembre de 2019 y julio de 2023, o prueba variaciones ilustrativas de 0,5, 1 y 2 puntos del voto válido provincial. Cada supuesto explica su magnitud y sus límites: ninguno estima lo que ocurrirá en 2026.</p></header><ContextualExplorer initial={ProvinceDataSchema.parse(leon)} initialHistory={HistorySchema.parse(history)} provinces={provinces} /></div>;
}
