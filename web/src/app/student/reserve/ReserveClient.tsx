"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { computeBusyIntervals } from "@/lib/availability";
import { freeSlotsForDay } from "@/lib/periods";

type Room = {
  id: string; code: string; building: string;
  floor: string | null; room_type: string | null; capacity: number | null;
};

type Course = { room_code: string; weekday: number; start_period: number; end_period: number };

// 08:00 ~ 22:00, 30분 단위 — 운영 가능 시간 (1~13교시 커버)
const OPERATION_START_MIN = 8 * 60;
const OPERATION_END_MIN = 22 * 60;
const HHMM_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = OPERATION_START_MIN; m <= OPERATION_END_MIN; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
})();

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Interval = { start: string; end: string };

function overlapsAny(start: string, end: string, busy: Interval[]): boolean {
  return busy.some((b) => start < b.end && b.start < end);
}

export default function ReserveClient({ rooms, courses }: { rooms: Room[]; courses: Course[] }) {
  const router = useRouter();
  const supabase = createClient();
  const params = useSearchParams();
  const presetRoom = params.get("room");
  const presetDate = params.get("date");
  const presetStart = params.get("start");
  const presetEnd = params.get("end");

  const [date, setDate] = useState(
    () => presetDate ?? new Date().toISOString().slice(0, 10),
  );
  const [selectedCode, setSelectedCode] = useState<string | null>(presetRoom);
  const [startTime, setStartTime] = useState(presetStart ?? "");
  const [endTime, setEndTime] = useState(presetEnd ?? "");
  const [purpose, setPurpose] = useState("");
  const [isEvent, setIsEvent] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const dayStart = new Date(date + "T00:00:00").toISOString();
      const dayEnd = new Date(date + "T23:59:59").toISOString();
      const { data } = await supabase
        .from("reservations")
        .select("room_id, start_time, end_time")
        .in("status", ["RESERVED", "CHECKED_IN"])
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd);
      setReservations(data ?? []);
    })();
  }, [date, supabase]);

  const busyMap = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    return computeBusyIntervals({ date: d, rooms, courses, reservations });
  }, [date, rooms, courses, reservations]);

  const freeByRoom = useMemo(() => {
    const m = new Map<string, Interval[]>();
    for (const r of rooms) m.set(r.id, freeSlotsForDay(busyMap.get(r.id) ?? []));
    return m;
  }, [rooms, busyMap]);

  const selected = rooms.find((r) => r.code === selectedCode) ?? null;
  const busyForRoom: Interval[] = selected ? busyMap.get(selected.id) ?? [] : [];

  // 날짜/강의실 변경 시 더 이상 유효하지 않은 시간은 초기화
  useEffect(() => {
    if (!selected || !startTime) return;
    const next = fromMin(toMin(startTime) + 30);
    if (overlapsAny(startTime, next, busyForRoom)) {
      setStartTime("");
      setEndTime("");
    } else if (endTime && overlapsAny(startTime, endTime, busyForRoom)) {
      setEndTime("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedCode, busyForRoom.length]);

  function isStartDisabled(t: string): boolean {
    if (!selected) return false;
    // 마지막 슬롯(21:00)은 시작으로 선택 불가 — 종료가 더 늦어야 하므로
    if (toMin(t) >= OPERATION_END_MIN) return true;
    const next = fromMin(toMin(t) + 30);
    return overlapsAny(t, next, busyForRoom);
  }
  function isEndDisabled(e: string): boolean {
    if (!startTime) return true;
    if (toMin(e) <= toMin(startTime)) return true;
    return overlapsAny(startTime, e, busyForRoom);
  }

  async function submit() {
    setError(null); setInfo(null);
    if (!selected) { setError("강의실을 선택하세요."); return; }
    if (!startTime || !endTime) { setError("시작/종료 시간을 선택하세요."); return; }
    if (toMin(startTime) < OPERATION_START_MIN) {
      setError("강의실 이용 가능 시간은 08:00부터입니다."); return;
    }
    if (toMin(endTime) > OPERATION_END_MIN) {
      setError("강의실 이용 가능 시간은 22:00까지입니다."); return;
    }
    if (toMin(startTime) >= toMin(endTime)) {
      setError("종료 시간이 시작 시간보다 늦어야 합니다."); return;
    }
    if (overlapsAny(startTime, endTime, busyForRoom)) {
      setError("선택한 시간대에 다른 예약 또는 수업이 있습니다. 다시 선택해주세요.");
      return;
    }

    setLoading(true);
    try {
      const start = new Date(`${date}T${startTime}:00`).toISOString();
      const end = new Date(`${date}T${endTime}:00`).toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase.from("reservations").insert({
        user_id: user.id,
        room_id: selected.id,
        start_time: start, end_time: end,
        purpose, is_event: isEvent,
        status: "RESERVED",
      });
      if (error) throw error;
      setInfo(isEvent
        ? "행사 예약이 접수되었습니다. 운영진 승인 후 확정됩니다."
        : "예약이 완료되었습니다. 홈 화면에서 확인하세요.");
      setPurpose("");
      setStartTime(""); setEndTime("");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">강의실 예약</h1>
        <p className="mt-1 text-sm text-slate-500">
          수업·행사가 없는 시간대만 자동으로 표시됩니다.
        </p>
      </header>

      <section className="rounded-2xl bg-white border border-slate-200 p-4">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1.5">날짜</span>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 mb-2">강의실 선택</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => {
            const free = freeByRoom.get(r.id) ?? [];
            const isSelected = r.code === selectedCode;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCode(r.code)}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    isSelected
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{r.code}</p>
                      <p className="text-xs text-slate-500">
                        {r.building}동 · {r.floor} · {r.room_type}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">정원 {r.capacity ?? "-"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {free.length === 0 && (
                      <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        여유 없음
                      </span>
                    )}
                    {free.slice(0, 4).map((s, i) => (
                      <span
                        key={i}
                        className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5"
                      >
                        {s.start}~{s.end}
                      </span>
                    ))}
                    {free.length > 4 && (
                      <span className="text-xs text-slate-500">+{free.length - 4}</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {selected && (
        <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">예약 신청: {selected.code}</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1.5">시작</span>
              <select
                value={startTime}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartTime(v);
                  if (endTime && (toMin(endTime) <= toMin(v) || overlapsAny(v, endTime, busyForRoom))) {
                    setEndTime("");
                  }
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">선택</option>
                {HHMM_SLOTS.map((t) => {
                  const dis = isStartDisabled(t);
                  return (
                    <option key={t} value={t} disabled={dis}>
                      {t}{dis ? " (사용 중)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1.5">종료</span>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={!startTime}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{startTime ? "선택" : "시작을 먼저 선택"}</option>
                {HHMM_SLOTS.map((t) => {
                  if (toMin(t) <= toMin(startTime || "00:00")) return null;
                  const dis = isEndDisabled(t);
                  return (
                    <option key={t} value={t} disabled={dis}>
                      {t}{dis ? " (사용 중)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1.5">용도</span>
            <input
              type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)}
              placeholder="팀플 / 스터디 / 행사 등"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isEvent} onChange={(e) => setIsEvent(e.target.checked)} />
            <span>행사 예약 (운영진 수동 승인)</span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {info}
            </p>
          )}

          <button
            type="button"
            onClick={submit} disabled={loading}
            className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-3"
          >
            {loading ? "요청 중..." : isEvent ? "행사 예약 신청" : "바로 예약"}
          </button>
        </section>
      )}
    </div>
  );
}
