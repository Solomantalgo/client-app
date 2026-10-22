export const todayStr = () => new Date().toISOString().split("T")[0];

export const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

export function fmtDate(value) {
  const date = new Date(value + "T00:00:00");
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
