// yyyy-mm-dd string from local date parts, not toISOString() (which
// converts to UTC and can shift the date by a day in IST).
export function toDateString(value) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
