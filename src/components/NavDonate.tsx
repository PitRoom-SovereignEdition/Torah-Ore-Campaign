"use client";
import { useRouter } from "next/navigation";

/** Nav "Donate" button. Opens the dialog when the page has one, otherwise goes to the campaign page with it open. */
export function NavDonate({ label, disabled }: { label: string; disabled: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn small"
      disabled={disabled}
      onClick={() => {
        const detail: { handled: boolean } = { handled: false };
        window.dispatchEvent(new CustomEvent("donate", { detail }));
        if (!detail.handled) router.push("/?donate=1");
      }}
    >
      {label}
    </button>
  );
}
