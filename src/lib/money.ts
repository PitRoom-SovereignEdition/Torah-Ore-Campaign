/** Currencies with 2 minor-unit digits only; keeps cents arithmetic uniform with Stripe. */
export const SUPPORTED_CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD", "ILS", "CHF"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(c: string): c is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(c);
}

export function formatMoney(cents: number, currency: string, locale = "en-US", compact = false): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: compact || whole ? 0 : 2,
    maximumFractionDigits: compact || whole ? 0 : 2,
  }).format(cents / 100);
}

/** Parse a user-typed amount ("1,800" / "36.50") to cents. Returns null if invalid. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[\s,$£€₪]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [w, f = ""] = cleaned.split(".");
  const cents = Number(w) * 100 + Number(f.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Convert an amount to the campaign currency using a stored rate (rate = campaign units per 1 unit of currency). */
export function convertCents(cents: number, rate: number): number {
  return Math.round(cents * rate);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = Array.from(parts[0])[0] ?? "?";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}
