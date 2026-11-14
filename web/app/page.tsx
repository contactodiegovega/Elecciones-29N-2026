import Link from "next/link";
import ProvinceExplorer from "@/components/ProvinceExplorer";
import leon from "@/public/data/provinces/24.json";
import provinces from "@/public/data/provinces/index.json";
import { ProvinceDataSchema } from "@/lib/province";

export default function Home() {
  return <div className="space-y-6">
    <section className="home-masthead">
      <div><p className="eyebrow">Del voto al diputado · España</p><h1 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">El Último <span className="text-accent">Escaño</span></h1>
        <p className="mt-3 text-lg text-stone-600">Descubre cómo se decidió el último diputado de tu provincia.</p>
        <p className="mt-1 text-sm text-stone-500">Resultados oficiales de 2023. Cambia los votos y entiende el reparto, al instante.</p>
      </div><Link href="/encuestas" className="secondary-pillar">Últimas encuestas <span aria-hidden="true">↗</span></Link>
    </section>
    <ProvinceExplorer initial={ProvinceDataSchema.parse(leon)} provinces={provinces} />
  </div>;
}
