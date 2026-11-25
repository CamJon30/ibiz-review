// Shared 12 Week cycle settings. To start a new cycle, change CYCLE_START here
// (use a Sunday so it lines up with the Sun-Sat week grid).
export const CYCLE_START = "2026-11-22";
export const CYCLE_WEEKS = 12;

const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Week number (1 to CYCLE_WEEKS) for a YYYY-MM-DD date. Math.round keeps it correct across daylight saving.
export function getCycleWeek(dateStr) {
  const diffDays = Math.round((parseDay(dateStr) - parseDay(CYCLE_START)) / 86400000);
  return Math.max(1, Math.min(CYCLE_WEEKS, Math.floor(diffDays / 7) + 1));
}
