// yyyy-mm-dd string from local date parts, not toISOString() (which
// converts to UTC and can shift the date by a day in IST).
export function toDateString(value) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateString(y, mo, d) {
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
    ? toDateString(date)
    : null;
}

// Accepts whatever a person is likely to type — YYYY-MM-DD, DD/MM/YYYY or
// DD-MM-YYYY, DD/MM with the year left off (defaults to the current year),
// or plain digits with no separator at all (DDMMYYYY / DDMM) — and always
// returns a canonical YYYY-MM-DD string, or null if nothing matched. Used
// both by DateField (the web form's typed date input) and bulk-upload
// validation, so an Excel cell and a typed field accept the same formats.
export function parseFlexibleDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return isNaN(value) ? null : toDateString(value);
  }
  const str = String(value).trim();
  const currentYear = new Date().getFullYear();

  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m.map(Number);
    return buildDateString(y, mo, d);
  }

  m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m.map(Number);
    return buildDateString(y, mo, d);
  }

  m = str.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const [, d, mo] = m.map(Number);
    return buildDateString(currentYear, mo, d);
  }

  m = str.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m.map(Number);
    return buildDateString(y, mo, d);
  }

  m = str.match(/^(\d{2})(\d{2})$/);
  if (m) {
    const [, d, mo] = m.map(Number);
    return buildDateString(currentYear, mo, d);
  }

  return null;
}
