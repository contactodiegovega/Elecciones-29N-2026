"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function RedirectProvince() {
  const router = useRouter();
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("province");
    router.replace(code ? `/?province=${encodeURIComponent(code)}#provincia` : "/#provincia");
  }, [router]);
  return <p>La calculadora está ahora en Inicio. <Link href="/" className="underline">Abrir la provincia y su calculadora</Link>.</p>;
}
export default function LegacyProvinceRoute() { return <RedirectProvince />; }
