/**
 * Single source of truth for the date/time format options offered on chart
 * x-axis fields (LineChart, WaterfallChart, ...) and the parsing logic behind
 * them. Add or change a format here and every chart picks it up.
 */
export const DATE_TIME_FORMAT_OPTIONS = [
  { value: "yyyy-mm-dd", label: "yyyy-mm-dd" },
  { value: "yyyy-mm-dd hh:mm:ss", label: "yyyy-mm-dd hh:mm:ss" },
  { value: "yyyy-mm-dd hh:mm", label: "yyyy-mm-dd hh:mm" },
  { value: "mmm day", label: "mmm day" },
  { value: "yyyy mmm", label: "yyyy mmm" },
  { value: "mmm day, yyyy", label: "mmm day, yyyy" },
  { value: "dd/mm/yyyy", label: "dd/mm/yyyy" },
  { value: "dd/mm/yyyy hh:mm:ss", label: "dd/mm/yyyy hh:mm:ss" },
  { value: "dd/mm/yyyy hh:mm", label: "dd/mm/yyyy hh:mm" },
  { value: "dd mmmm yyyy", label: "dd mmmm yyyy" },
  { value: "dd mmmm yyyy hh:mm:ss", label: "dd mmmm yyyy hh:mm:ss" },
  { value: "dd mmmm yyyy hh:mm", label: "dd mmmm yyyy hh:mm" },
];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value == null) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function readCategoryLabel(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

export function formatAxisValue(value: unknown, format?: string): string {
  if (!format?.trim()) return readCategoryLabel(value);

  const date = parseDateValue(value);
  if (!date) return readCategoryLabel(value);

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ymd = `${year}-${pad2(month + 1)}-${pad2(day)}`;
  const dmy = `${pad2(day)}/${pad2(month + 1)}/${year}`;
  const time = `${pad2(hours)}:${pad2(minutes)}`;
  const timeSec = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

  switch (format) {
    case "yyyy-mm-dd":
      return ymd;
    case "yyyy-mm-dd hh:mm:ss":
      return `${ymd} ${timeSec}`;
    case "yyyy-mm-dd hh:mm":
      return `${ymd} ${time}`;
    case "mmm day":
      return `${MONTHS_SHORT[month]} ${day}`;
    case "yyyy mmm":
      return `${year} ${MONTHS_SHORT[month]}`;
    case "mmm day, yyyy":
      return `${MONTHS_SHORT[month]} ${day}, ${year}`;
    case "dd/mm/yyyy":
      return dmy;
    case "dd/mm/yyyy hh:mm:ss":
      return `${dmy} ${timeSec}`;
    case "dd/mm/yyyy hh:mm":
      return `${dmy} ${time}`;
    case "dd mmmm yyyy":
      return `${pad2(day)} ${MONTHS_LONG[month]} ${year}`;
    case "dd mmmm yyyy hh:mm:ss":
      return `${pad2(day)} ${MONTHS_LONG[month]} ${year} ${timeSec}`;
    case "dd mmmm yyyy hh:mm":
      return `${pad2(day)} ${MONTHS_LONG[month]} ${year} ${time}`;
    default:
      return readCategoryLabel(value);
  }
}