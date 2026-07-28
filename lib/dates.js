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

  // 2-digit year (31/7/25) — this app only ever deals in 2000s dates, so
  // always prepend 20 rather than guessing a 1900s/2000s pivot.
  m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) {
    const [, d, mo, y] = m.map(Number);
    return buildDateString(2000 + y, mo, d);
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

  m = str.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const [, d, mo, y] = m.map(Number);
    return buildDateString(2000 + y, mo, d);
  }

  m = str.match(/^(\d{2})(\d{2})$/);
  if (m) {
    const [, d, mo] = m.map(Number);
    return buildDateString(currentYear, mo, d);
  }

  return null;
}

// Builds the date-range WHERE-clause pieces shared by every list page's Year
// filter. A custom from/to range (the DateRangeFilter control) takes
// priority over the whole-year Year filter whenever both happen to be set —
// picking an explicit range is strictly more precise than picking a whole
// year, so there's no reason to AND them together and no ambiguity to
// resolve. Mutates conditions/params in place, matching how each caller
// already builds up its own WHERE clause piece by piece.
export function applyDateRangeFilter(conditions, params, column, { from, to, year, yearType }) {
  if (from || to) {
    if (from) {
      params.push(from);
      conditions.push(`${column} >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`${column} <= $${params.length}::date`);
    }
    return;
  }
  if (!year) return;
  if (yearType === "fy") {
    params.push(`${year}-04-01`);
    conditions.push(`${column} >= $${params.length}::date`);
    params.push(`${Number(year) + 1}-03-31`);
    conditions.push(`${column} <= $${params.length}::date`);
  } else {
    params.push(`${year}-01-01`);
    conditions.push(`${column} >= $${params.length}::date`);
    params.push(`${year}-12-31`);
    conditions.push(`${column} <= $${params.length}::date`);
  }
}

// "Entered Today" filters by when the row was actually created in the
// system (created_at) rather than its own business date field — finds
// everything entered today even if it's back-dated. `enteredOn` is the
// caller's own local YYYY-MM-DD (computed client-side, not server-side —
// the app is used from India but a serverless function's clock can be in
// any timezone, so "today" has to come from the browser). Converts the
// stored UTC timestamp to IST explicitly before truncating to a date, so
// an entry made just after midnight IST isn't misattributed to the
// previous day.
export function applyEnteredOnFilter(conditions, params, column, enteredOn) {
  if (!enteredOn) return;
  params.push(enteredOn);
  conditions.push(`(${column} AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}::date`);
}
