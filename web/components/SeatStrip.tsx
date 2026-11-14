import { shortCandidacy } from "@/lib/last-seat";

export default function SeatStrip({ allocation, colors, label }: {
  allocation: Record<string, number>; colors: Record<string, string>; label: string;
}) {
  const groups = Object.entries(allocation).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  return <div>
    <div className="flex flex-wrap gap-2" role="img" aria-label={`${label}: ${groups.map(([p, n]) => `${shortCandidacy(p)} ${n}`).join(", ") || "Sin diputados adjudicados"}`}>
      {groups.flatMap(([party, n]) => Array.from({ length: n }, (_, i) => <span key={`${party}-${i}`} title={shortCandidacy(party)} className="seat-symbol" style={{ backgroundColor: colors[party] }} />))}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">{groups.map(([p, n]) => <span key={p}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[p] }} /><strong>{shortCandidacy(p)} {n}</strong></span>)}</div>
  </div>;
}
