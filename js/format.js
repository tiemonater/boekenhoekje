// Dutch formatting helpers: money and dates.

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

// Prices are stored as whole cents (1250 = € 12,50) to avoid rounding errors.
export function formatEuro(cents) {
  return euro.format((cents ?? 0) / 100);
}

const longDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

export function formatDate(value) {
  if (!value) return "";
  return longDate.format(new Date(value));
}
