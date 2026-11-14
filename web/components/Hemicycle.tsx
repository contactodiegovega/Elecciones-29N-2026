import { fmtInt } from "@/lib/utils";

export default function Hemicycle({ parties }: { parties: { party_id: string; seats_2023_official: number; hex_color: string }[] }) {
  const groups = parties.filter(p => p.seats_2023_official > 0).sort((a, b) => b.seats_2023_official - a.seats_2023_official);
  const seats = groups.flatMap(p => Array.from({ length: p.seats_2023_official }, () => p));
  const rows = [40, 46, 54, 62, 70, 78]; // Exactly 350 individual seats.
  const positions = rows.flatMap((count, row) => Array.from({ length: count }, (_, i) => {
    const radius = 139 + row * 34;
    const angle = Math.PI - (i / (count - 1)) * Math.PI;
    return { x: 330 + radius * Math.cos(angle), y: 320 - radius * Math.sin(angle), angle, row };
  })).sort((a, b) => b.angle - a.angle || a.row - b.row);
  return <div>
    <svg viewBox="0 0 660 340" role="img" aria-labelledby="hemicycle-title" className="mx-auto w-full max-w-2xl">
      <title id="hemicycle-title">{`Los 350 diputados elegidos en 2023: ${groups.map(p => `${p.party_id} ${p.seats_2023_official}`).join(", ")}. Mayoría absoluta: 176.`}</title>
      {positions.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={5.1} fill={seats[index]?.hex_color ?? "#a8a29e"}><title>{`${seats[index]?.party_id ?? "Sin asignar"} · escaño ${index + 1}`}</title></circle>)}
      <text x="330" y="251" textAnchor="middle" fill="#14213d" fontSize="62" fontWeight="750">350</text>
      <text x="330" y="278" textAnchor="middle" fill="#57534e" fontSize="14">diputados · resultado 2023</text>
      <text x="330" y="306" textAnchor="middle" fill="#0f766e" fontSize="15" fontWeight="600">176 · mayoría absoluta</text>
    </svg>
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs" aria-label="Escaños por partido en 2023">{groups.map(p => <li key={p.party_id}><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.hex_color }} />{p.party_id} <strong>{fmtInt(p.seats_2023_official)}</strong></li>)}</ul>
    <p className="mt-3 text-center text-[11px] text-stone-500">Orden por número de escaños, sin agrupación por bloques.</p>
  </div>;
}
