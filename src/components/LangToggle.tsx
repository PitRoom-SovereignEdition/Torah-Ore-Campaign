"use client";
import { useRouter } from "next/navigation";

export function LangToggle({ lang, label }: { lang: "en" | "he"; label: string }) {
  const router = useRouter();
  const set = (l: "en" | "he") => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div className="langs" role="group" aria-label={label}>
      <button type="button" aria-pressed={lang === "en"} onClick={() => set("en")}>EN</button>
      <button type="button" aria-pressed={lang === "he"} onClick={() => set("he")}>עב</button>
    </div>
  );
}
