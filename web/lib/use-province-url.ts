"use client";
import { useSyncExternalStore } from "react";
import { resolveProvince } from "./last-seat";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("provincechange", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("provincechange", callback);
  };
}
const snapshot = () => new URLSearchParams(window.location.search).get("province");
const serverSnapshot = () => null;

/** A static export has no request-time search params. Read the real browser URL
 * as an external store rather than suspending hydration on a server query.
 */
export function useProvinceUrl(codes: string[]) {
  const requested = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const code = resolveProvince(requested, codes);
  const select = (next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("province", next);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event("provincechange"));
  };
  return { requested, code, select };
}
