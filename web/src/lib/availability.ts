import { PERIODS, type Slot } from "./periods";

const TZ = "Asia/Seoul";

type BusyPeriodRow = { room_code: string; weekday: number; start_period: number; end_period: number };
type BusyReservation = { room_id: string; start_time: string; end_time: string };

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);
}

/** YYYY-MM-DD 를 KST 기준 요일(0=일, 6=토)로 변환. 로컬 TZ 영향 없음. */
export function weekdayFromYMD(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  // UTC noon 으로 생성해 어떤 TZ 에서도 날짜 변화 없음, 그 날의 요일 반환
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** ISO timestamp 를 KST 기준 YYYY-MM-DD 로 포맷. */
export function kstYMDFromISO(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

/** ISO timestamp 를 KST 기준 HH:mm 으로 포맷. */
export function kstHHMMFromISO(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export interface RoomAvailability { room_id: string; code: string; busy: Slot[] }

/**
 * 지정 날짜(KST, YYYY-MM-DD)의 강의 + 예약을 room별 busy 구간으로 반환.
 *
 * - weekday 는 KST 기준 요일 (seed_courses.py 와 매핑 일치: 일=0 … 토=6)
 * - 예약 겹침 판정: [slotStart, slotEnd) 와 busy 가 1분이라도 겹치면 busy
 * - 10~13교시(18:00~22:00) 야간 강좌도 PERIODS 테이블에 매핑돼 있어 정상 포함
 */
export function computeBusyIntervals(args: {
  dateYMD: string;
  rooms: { id: string; code: string }[];
  courses: BusyPeriodRow[];
  reservations: BusyReservation[];
}): Map<string, Slot[]> {
  const { dateYMD, rooms, courses, reservations } = args;
  const weekday = weekdayFromYMD(dateYMD);
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

  for (const r of reservations) {
    if (kstYMDFromISO(r.start_time) !== dateYMD) continue;
    const list = map.get(r.room_id);
    if (!list) continue;
    list.push({ start: kstHHMMFromISO(r.start_time), end: kstHHMMFromISO(r.end_time) });
  }

  return map;
}

export { overlap };
