"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { computeBusyIntervals } from "@/lib/availability";
import { PERIODS } from "@/lib/periods";

type Room = {
  id: string; code: string; building: string;
  floor: string | null; room_type: string | null; capacity: number | null;
};
type Course = { room_code: string; weekday: number; start_period: number; end_period: number };
type Reservation = { room_id: string; start_time: string; end_time: string };

const SLOTS = PERIODS.map((p) => ({ start: p.start, end: p.end }));

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

function nearestSlot(hhmm: string): string {
  const found = SLOTS.find((s) => s.start <= hhmm && hhmm < s.end);
  if (found) return `${found.start}-${found.end}`;
  // 운영시간 전/후면 첫/마지막 슬롯
  return hhmm < SLOTS[0].start
    ? `${SLOTS[0].start}-${SLOTS[0].end}`
    : `${SLOTS.at(-1)!.start}-${SLOTS.at(-1)!.end}`;
}

export default function PickSection({
  rooms, courses, reservations,
}: {
  rooms: Room[]; courses: Course[]; reservations: Reservation[];
}) {
  const [date, setDate] = useState(() => todayKST());
  const [slot, setSlot] = useState(() => nearestSlot(currentHHMM()));
  const [building, setBuilding] = useState<"ALL" | "N-13" | "N-14">("ALL");

  const [slotStart, slotEnd] = slot.split("-");

  const freeRooms = useMemo(() => {
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
  }, [date, slotStart, slotEnd, building, rooms, courses, reservations]);

  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-semibold text-slate-900">바로 Pick</h2>
        <Link href="/student/reserve" className="text-xs text-brand-500">예약 페이지 →</Link>
      </div>

      <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-3 flex flex-wrap gap-2">
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={slot} onChange={(e) => setSlot(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {SLOTS.map((s, i) => (
            <option key={s.start} value={`${s.start}-${s.end}`}>
              {i + 1}교시 · {s.start}~{s.end}
            </option>
          ))}
        </select>
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
