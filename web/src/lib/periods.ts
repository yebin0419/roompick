export const OPERATING_START_HOUR = 9;
export const OPERATING_END_HOUR = 22;

export const PERIODS: { period: number; start: string; end: string }[] = [
  { period: 1, start: "09:00", end: "10:00" },
  { period: 2, start: "10:00", end: "11:00" },
  { period: 3, start: "11:00", end: "12:00" },
  { period: 4, start: "12:00", end: "13:00" },
  { period: 5, start: "13:00", end: "14:00" },
  { period: 6, start: "14:00", end: "15:00" },
  { period: 7, start: "15:00", end: "16:00" },
  { period: 8, start: "16:00", end: "17:00" },
  { period: 9, start: "17:00", end: "18:00" },
  { period: 10, start: "18:00", end: "19:00" },
  { period: 11, start: "19:00", end: "20:00" },
  { period: 12, start: "20:00", end: "21:00" },
  { period: 13, start: "21:00", end: "22:00" },
];

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const WEEKDAY_INDEX: Record<string, number> = {
  일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6,
};

export interface Slot { start: string; end: string }

export function periodToTime(period: number): { start: string; end: string } | null {
  return PERIODS.find((p) => p.period === period) ?? null;
}

export function slotsFromPeriods(periods: number[]): Slot[] {
  if (periods.length === 0) return [];
  const sorted = [...periods].sort((a, b) => a - b);
  const slots: Slot[] = [];
  let s = sorted[0];
  let e = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === e + 1) e = sorted[i];
    else {
      slots.push({ start: periodToTime(s)!.start, end: periodToTime(e)!.end });
      s = sorted[i];
      e = sorted[i];
    }
  }
  slots.push({ start: periodToTime(s)!.start, end: periodToTime(e)!.end });
  return slots;
}

export function freeSlotsForDay(
  busy: Slot[],
  dayStart = `${String(OPERATING_START_HOUR).padStart(2, "0")}:00`,
  dayEnd = `${String(OPERATING_END_HOUR).padStart(2, "0")}:00`,
): Slot[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (min: number) => {
    const h = Math.floor(min / 60), m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const sorted = busy
    .map((s) => ({ s: toMin(s.start), e: toMin(s.end) }))
    .sort((a, b) => a.s - b.s);
  const merged: { s: number; e: number }[] = [];
  for (const b of sorted) {
    if (merged.length && b.s <= merged[merged.length - 1].e) {
      merged[merged.length - 1].e = Math.max(merged[merged.length - 1].e, b.e);
    } else merged.push({ ...b });
  }
  const free: Slot[] = [];
  let cur = toMin(dayStart);
  const end = toMin(dayEnd);
  for (const b of merged) {
    if (b.s > cur) free.push({ start: toTime(cur), end: toTime(Math.min(b.s, end)) });
    cur = Math.max(cur, b.e);
    if (cur >= end) break;
  }
  if (cur < end) free.push({ start: toTime(cur), end: toTime(end) });
  return free;
}
