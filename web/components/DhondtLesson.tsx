"use client";
import { useState } from "react";
import leon from "@/public/data/provinces/24.json";
import { analyzeLastSeat, shortCandidacy } from "@/lib/last-seat";
import { fmtDec } from "@/lib/utils";

export default function DhondtLesson() {
  const [step, setStep] = useState(1);
  const analysis = analyzeLastSeat(leon.rows, leon.seats2023, leon.turnout.votos_blancos);
  return <div className="mt-5 rounded-xl bg-stone-100 p-5">
    <p className="eyebrow">León · resultados oficiales 2023</p><p className="mt-2 text-sm text-stone-600">Avanza diputado a diputado. Gana el cociente más alto que todavía no tenga escaño.</p>
    <ol className="mt-4 grid gap-2 sm:grid-cols-2">{analysis.quotients.slice(0, leon.seats2023 + 1).map(q => <li key={q.rank} className={`flex items-center justify-between gap-3 rounded-lg p-3 text-sm ${q.rank <= step ? "bg-white font-semibold" : "text-stone-400"}`}><span>#{q.rank} {shortCandidacy(q.label)} ÷ {q.divisor}</span><span className="tabular">{fmtDec(q.value)} {q.rank <= step ? "✓" : ""}</span></li>)}</ol>
    <div className="mt-4 flex items-center gap-4"><button type="button" className="button-secondary" disabled={step === 1} onClick={() => setStep(s => s - 1)}>Anterior</button><span className="text-xs text-stone-500" role="status">Diputado {step} de {leon.seats2023}</span><button type="button" className="button-primary disabled:opacity-40" disabled={step === leon.seats2023} onClick={() => setStep(s => s + 1)}>Siguiente</button></div>
    {step === leon.seats2023 && <p className="mt-4 text-sm">El último diputado lo recibe <strong>{shortCandidacy(analysis.last!.label)}</strong>. El siguiente cociente ({shortCandidacy(analysis.next!.label)}) queda fuera.</p>}
  </div>;
}
