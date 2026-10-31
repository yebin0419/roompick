import { PERIODS, type Slot } from "./periods";

type BusyPeriodRow = { room_code: string; weekday: number; start_period: number; end_period: number };
type BusyReservation = { room_id: string; start_time: string; end_time: string };

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);
}

export interface RoomAvailability {
  room_id: string;
  code: string;
  busy: Slot[];
}

/**
 * 특정 날짜(KST 가정)의 강의/예약을 합쳐 room별 busy 구간을 반환.
 */
export function computeBusyIntervals(args: {
  date: Date;
  rooms: { id: string; code: string }[];
  courses: BusyPeriodRow[];
  reservations: BusyReservation[];
}): Map<string, Slot[]> {
  const { date, rooms, courses, reservations } = args;
  const weekday = date.getDay();
  const map = new Map<string, Slot[]>();
  for (const r of rooms) map.set(r.id, []);

  for (const c of courses) {
    if (c.weekday !== weekday) continue;
    const start = PERIODS.find((p) => p.period === c.start_period)?.start;
    const end = PERIODS.find((p) => p.period === c.end_period)?.end;
    if (!start || !end) continue;
    const room = rooms.find((r) => r.code === c.room_code);
    if (!room) continue;
    map.get(room.id)!.push({ start, end });
  }

  const toHHMM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const sameDay = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate();
  };

  for (const r of reservations) {
    if (!sameDay(r.start_time)) continue;
    const list = map.get(r.room_id);
    if (!list) continue;
    list.push({ start: toHHMM(r.start_time), end: toHHMM(r.end_time) });
  }

  return map;
}

export { overlap };
