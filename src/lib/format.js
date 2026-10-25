const datePartsInKampala = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

export const todayStr = (now = new Date()) => {
  const parts = datePartsInKampala(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const addDays = (days, now = new Date()) => {
  const [year, month, day] = todayStr(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return date.toISOString().split("T")[0];
};

export function fmtDate(value) {
  const date = new Date(`${value}T12:00:00+03:00`);
  if (value === todayStr()) return "Today";
  return date.toLocaleDateString("en-UG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function fmtUGX(amount) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

export function toWaNumber(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("256")) return digits;
  if (digits.startsWith("0")) return `256${digits.slice(1)}`;
  return `256${digits}`;
}
