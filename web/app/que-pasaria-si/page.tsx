import ProvinceExplorer from "@/components/ProvinceExplorer";
import leon from "@/public/data/provinces/24.json";
import provinces from "@/public/data/provinces/index.json";
import { ProvinceDataSchema } from "@/lib/province";

export default function ScenariosPage() {
  return <div className="space-y-7"><header className="hero-editorial"><p className="eyebrow">Un laboratorio de posibilidades · con datos reales</p><h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">¿Qué pasaría si <span className="text-accent">cambiaran los votos?</span></h1><p className="mt-4 max-w-2xl text-lg text-stone-600">¿Cómo cambiaría el reparto de diputados si las candidaturas recibieran otros votos?</p><p className="mt-3 max-w-2xl text-sm text-stone-500">Partimos de los resultados oficiales de 2023 y sus escaños provinciales. Explora supuestos matemáticos: no son previsiones de 2026 ni recomendaciones de voto.</p></header><ProvinceExplorer initial={ProvinceDataSchema.parse(leon)} provinces={provinces} scenarios /></div>;
}
