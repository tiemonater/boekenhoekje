// Dutch formatting helpers: money and dates.

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

// Prices are stored as whole cents (1250 = € 12,50) to avoid rounding errors.
export function formatEuro(cents) {
  return euro.format((cents ?? 0) / 100);
}

const longDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

// Today as "2026-11-24", in the phone's own time zone.
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDate(value) {
  if (!value) return "";
  return longDate.format(new Date(value));
}
