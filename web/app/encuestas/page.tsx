import type { Metadata } from "next";
import LatestPolls from "@/components/LatestPolls";
export const metadata: Metadata = { title: "Últimas encuestas — El Último Escaño", description: "Sondeos con fecha de publicación y fuente primaria verificadas. Una ficha clara por encuesta y análisis ampliado opcional." };
export default function Encuestas() { return <LatestPolls />; }
