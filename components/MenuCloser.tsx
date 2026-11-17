"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Closes the mobile header menu after a link is followed, so it doesn't sit on top of the next page (e.g. the login form). */
export function MenuCloser() {
  const path = usePathname();
  useEffect(() => {
    const box = document.getElementById("menu") as HTMLInputElement | null;
    if (box) box.checked = false;
  }, [path]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.(".site-h .nav a");
      const box = document.getElementById("menu") as HTMLInputElement | null;
      if (a && box) box.checked = false;
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
