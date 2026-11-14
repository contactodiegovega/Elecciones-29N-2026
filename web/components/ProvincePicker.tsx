"use client";
import { useId, useState } from "react";
import type { ProvinceIndex } from "@/lib/province";

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function ProvincePicker({ provinces, selected, onSelect }: {
  provinces: ProvinceIndex[]; selected: string; onSelect: (code: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const options = [...provinces].sort((a, b) => a.name.localeCompare(b.name, "es")).filter(p => normalize(`${p.name} ${p.code}`).includes(normalize(query)));
  const choose = (code: string) => { onSelect(code); setOpen(false); setQuery(""); };
  return <div className="province-picker" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id} className="eyebrow">Tu provincia, tu último escaño</label>
    <div className="relative mt-2">
      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-3.5 text-xl text-accent">⌕</span>
      <input id={id} role="combobox" autoComplete="off" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${id}-${options[active].code}` : undefined}
        value={open ? query : provinces.find(p => p.code === selected)?.name ?? ""} placeholder="Busca entre las 52 circunscripciones…"
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={e => {
          if (e.key === "Escape") { setOpen(false); e.preventDefault(); }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setOpen(true);
            setActive(i => Math.max(0, Math.min(options.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
          }
          if (e.key === "Enter" && open && options[active]) { e.preventDefault(); choose(options[active].code); }
        }}
        className="w-full rounded-xl border-2 border-ink/20 bg-white py-3 pl-11 pr-12 text-lg font-semibold text-ink shadow-sm transition focus:border-accent focus:outline-none" />
      <button type="button" aria-label="Mostrar las 52 circunscripciones" aria-expanded={open} onClick={() => { setOpen(!open); setQuery(""); setActive(0); }} className="absolute right-1 top-1 rounded-lg px-3 py-3 text-accent">⌄</button>
      {open && <ul id={`${id}-list`} role="listbox" aria-label="Circunscripciones" className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-xl">
        {options.map((p, i) => <li key={p.code} id={`${id}-${p.code}`} role="option" aria-selected={p.code === selected}>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(p.code)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${active === i ? "bg-teal-50 text-ink" : "hover:bg-stone-50"}`}>
            <span className="font-medium">{p.name}</span><span className="text-xs text-stone-500">{p.seats2023} diputados · 2023</span>
          </button>
        </li>)}
        {!options.length && <li className="p-3 text-sm text-stone-500" role="presentation">No encontramos esa provincia. Prueba otro nombre.</li>}
      </ul>}
    </div>
  </div>;
}
