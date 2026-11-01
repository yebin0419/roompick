"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { computeBusyIntervals } from "@/lib/availability";

type Room = {
  id: string; code: string; building: string;
  floor: string | null; room_type: string | null; capacity: number | null;
};
type Course = { room_code: string; weekday: number; start_period: number; end_period: number };
type Reservation = { room_id: string; start_time: string; end_time: string };

// 08:00 ~ 21:00, 30분 단위 — 운영 가능 시간
const OPERATION_START_MIN = 8 * 60;
const OPERATION_END_MIN = 21 * 60;
const HHMM_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = OPERATION_START_MIN; m <= OPERATION_END_MIN; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
})();

function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "numeric",
  }).format(new Date());
}

function currentHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMin(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 현재 시각을 30분 단위로 올림. 운영시간 밖이면 09:00. 운영 종료 직전이면 17:30. */
function defaultStart(): string {
  const now = toMin(currentHHMM());
  const first = toMin(HHMM_SLOTS[0]);
  const lastStart = toMin(HHMM_SLOTS[HHMM_SLOTS.length - 2]); // 운영 종료 30분 전
  if (now <= first) return HHMM_SLOTS[0];
  if (now >= lastStart) return fromMin(lastStart);
  const rounded = Math.ceil(now / 30) * 30;
  return fromMin(Math.min(rounded, lastStart));
}

function defaultEnd(start: string): string {
  const target = toMin(start) + 60;
  const last = toMin(HHMM_SLOTS[HHMM_SLOTS.length - 1]); // 운영 종료 시각
  return fromMin(Math.min(target, last));
}

export default function PickSection({
  rooms, courses, reservations,
}: {
  rooms: Room[]; courses: Course[]; reservations: Reservation[];
}) {
  const [date, setDate] = useState(() => todayKST());
  const [slotStart, setSlotStart] = useState(() => defaultStart());
  const [slotEnd, setSlotEnd] = useState(() => defaultEnd(defaultStart()));
  const [building, setBuilding] = useState<"ALL" | "N-13" | "N-14">("ALL");

  // 시작이 바뀌면 종료가 더 이르면 자동 보정
  function handleStartChange(v: string) {
    setSlotStart(v);
    if (toMin(slotEnd) <= toMin(v)) setSlotEnd(defaultEnd(v));
  }

  const rangeValid = toMin(slotEnd) > toMin(slotStart);

  const freeRooms = useMemo(() => {
    if (!rangeValid) return [];
    const d = new Date(date + "T00:00:00");
    const sameDayRes = reservations.filter((r) => {
      const rd = new Date(r.start_time);
      return rd.getFullYear() === d.getFullYear()
        && rd.getMonth() === d.getMonth()
        && rd.getDate() === d.getDate();
    });
    const busyMap = computeBusyIntervals({
      date: d, rooms, courses, reservations: sameDayRes,
    });
    return rooms
      .filter((r) => building === "ALL" || r.building === building)
      .filter((r) => {
        const busy = busyMap.get(r.id) ?? [];
        return !busy.some((b) => b.start < slotEnd && slotStart < b.end);
      });
  }, [date, slotStart, slotEnd, building, rooms, courses, reservations, rangeValid]);

  const endOptions = HHMM_SLOTS.filter((t) => toMin(t) > toMin(slotStart));

  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-semibold text-slate-900">바로 Pick</h2>
        <Link href="/student/reserve" className="text-xs text-brand-500">예약 페이지 →</Link>
      </div>

      <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-3 flex flex-wrap items-center gap-2">
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-1">
          <select
            value={slotStart} onChange={(e) => handleStartChange(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {HHMM_SLOTS.slice(0, -1).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="text-slate-400 text-sm">~</span>
          <select
            value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {endOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex rounded-lg border border-slate-200 text-sm overflow-hidden">
          {(["ALL", "N-13", "N-14"] as const).map((b) => (
            <button
              key={b} type="button" onClick={() => setBuilding(b)}
              className={`px-3 py-2 ${
                building === b ? "bg-brand-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {b === "ALL" ? "전체" : `${b}동`}
            </button>
          ))}
        </div>
      </div>

      {!rangeValid && (
        <p className="mt-2 text-xs text-red-600">종료 시간이 시작 시간보다 늦어야 합니다.</p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>선택한 시간대 · 비어 있는 강의실 <b className="text-slate-900">{freeRooms.length}</b>개</span>
      </div>

      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {freeRooms.map((r) => (
          <li key={r.code} className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{r.code}</p>
                <p className="text-xs text-slate-500">
                  {r.building}동 · {r.floor} · {r.room_type}
                </p>
              </div>
              <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">
                {slotStart}~{slotEnd}
              </span>
            </div>
            <Link
              href={`/student/reserve?room=${encodeURIComponent(r.code)}&date=${date}&start=${slotStart}&end=${slotEnd}`}
              className="mt-3 block text-center text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white py-2"
            >
              바로 예약
            </Link>
          </li>
        ))}
        {freeRooms.length === 0 && (
          <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-3 py-6 text-center">
            선택한 시간대에 비어 있는 강의실이 없어요.
          </p>
        )}
      </ul>
    </section>
  );
}
