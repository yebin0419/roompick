import type { DayOfWeek } from "@/lib/supabase/types";

export const DAY_OPTIONS: Array<{ key: DayOfWeek; label: string }> = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
];

export const PERIOD_CODES = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
];

const PERIOD_START_HOUR: Record<string, number> = {
  "01": 9,
  "02": 10,
  "03": 11,
  "04": 12,
  "05": 13,
  "06": 14,
  "07": 15,
  "08": 16,
  "09": 17,
};

const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
  0: "SUN",
};

const DAY_TO_JS: Record<DayOfWeek, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export function currentDayAndPeriod(): { day: DayOfWeek; period: string } {
  const now = new Date();
  const jsDay = now.getDay();
  const dayEnum = JS_DAY_TO_ENUM[jsDay] ?? "MON";
  const day = dayEnum === "SAT" || dayEnum === "SUN" ? "MON" : dayEnum;
  const hour = now.getHours();
  const match = Object.entries(PERIOD_START_HOUR).find(([, h]) => h === hour);
  return { day, period: match?.[0] ?? "01" };
}

export function nextDateFor(day: DayOfWeek, from: Date = new Date()): string {
  const target = DAY_TO_JS[day];
  const current = from.getDay();
  const diff = (target - current + 7) % 7;
  const d = new Date(from);
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function periodLabel(code: string): string {
  const hour = PERIOD_START_HOUR[code];
  if (hour === undefined) return code;
  const end = String(hour + 1).padStart(2, "0");
  return `${code}교시 (${String(hour).padStart(2, "0")}:00~${end}:00)`;
}

export function periodRangeLabel(start: string, end: string): string {
  return start === end ? start : `${start}-${end}`;
}
