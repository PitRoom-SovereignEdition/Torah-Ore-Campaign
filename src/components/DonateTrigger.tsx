"use client";

/** Any button on the page that opens the donation dialog (optionally with a prefilled amount). */
export function DonateTrigger({ children, amount, className = "btn", disabled, id }: { children: React.ReactNode; amount?: number; className?: string; disabled?: boolean; id?: string }) {
  return (
    <button id={id} type="button" className={className} disabled={disabled} onClick={() => window.dispatchEvent(new CustomEvent("donate", { detail: { amount } }))}>
      {children}
    </button>
  );
}
