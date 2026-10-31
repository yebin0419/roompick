"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  currentDayAndPeriod,
  DAY_OPTIONS,
  nextDateFor,
  PERIOD_CODES,
  periodLabel,
  periodRangeLabel,
} from "@/lib/periods";
import { createClient } from "@/lib/supabase/browser";
import type { DayOfWeek, Reservation, Room } from "@/lib/supabase/types";

type Props = {
  userId: string;
  name: string | null;
  studentNumber: string | null;
};

const STATUS_LABEL: Record<Reservation["status"], string> = {
  AUTO_APPROVED: "자동 승인",
  PENDING_OPERATOR: "운영진 대기",
  PENDING_ADMIN: "행정실 대기",
  APPROVED: "승인",
  REJECTED: "거절",
  CANCELLED: "취소",
};

export default function StudentHomeClient({ userId, name, studentNumber }: Props) {
  const initial = useMemo(() => currentDayAndPeriod(), []);
  const [day, setDay] = useState<DayOfWeek>(initial.day);
  const [period, setPeriod] = useState<string>(initial.period);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [occupied, setOccupied] = useState<Set<string>>(new Set());
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const date = useMemo(() => nextDateFor(day), [day]);
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    const [roomRes, sessionRes, reservationRes, myRes] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("in_scope", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("course_sessions")
        .select("room_code")
        .eq("day", day)
        .eq("period_code", period),
      supabase
        .from("reservations")
        .select("room_code")
        .eq("reservation_date", date)
        .lte("start_period", period)
        .gte("end_period", period)
        .in("status", ["AUTO_APPROVED", "APPROVED", "PENDING_OPERATOR", "PENDING_ADMIN"]),
      supabase
        .from("reservations")
        .select("*")
        .eq("student_id", userId)
        .in("status", ["AUTO_APPROVED", "APPROVED", "PENDING_OPERATOR", "PENDING_ADMIN"])
        .gte("reservation_date", new Date().toISOString().slice(0, 10))
        .order("reservation_date", { ascending: true })
        .order("start_period", { ascending: true })
        .limit(3),
    ]);
    setRooms(roomRes.data ?? []);
    const occ = new Set<string>();
    for (const s of sessionRes.data ?? []) if (s.room_code) occ.add(s.room_code);
    for (const r of reservationRes.data ?? []) if (r.room_code) occ.add(r.room_code);
    setOccupied(occ);
    setMyReservations((myRes.data ?? []) as Reservation[]);
    setLoading(false);
  }, [supabase, day, period, date, userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const freeRooms = rooms.filter((r) => !occupied.has(r.code));
  const groups = new Map<string, Room[]>();
  for (const r of freeRooms) {
    const key = `${r.building} · ${r.floor ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            안녕하세요, {name ?? "학생"}님
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            학번 {studentNumber ?? "-"} · 오늘은 비어 있는 강의실을 선택해 바로 예약할
            수 있어요.
          </p>
        </div>
      </header>

      {/* 빠른 메뉴 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickMenu href="/student/reserve" icon="📅" label="예약하기" />
        <QuickMenu href="/student/check-in" icon="✓" label="체크인" />
        <QuickMenu href="/student/reports" icon="⚠️" label="신고" />
        <QuickMenu href="/student/preferences" icon="⚙️" label="맞춤 알림" />
      </section>

      {/* 내 예약 요약 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">곧 다가올 내 예약</h2>
          <span className="text-xs text-zinc-400">최근 3건</span>
        </div>
        {myReservations.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-zinc-200 py-6 text-center text-xs text-zinc-400">
            예정된 예약이 없습니다.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {myReservations.map((r) => {
              const canCheckIn =
                (r.status === "AUTO_APPROVED" || r.status === "APPROVED") &&
                !r.checked_in_at;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-zinc-800">{r.room_code}</span>
                    <span className="ml-2 text-zinc-500">
                      {r.reservation_date} ·{" "}
                      {periodRangeLabel(r.start_period, r.end_period)}교시
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                      {STATUS_LABEL[r.status]}
                    </span>
                    {canCheckIn && (
                      <Link
                        href={{ pathname: "/student/check-in", query: { id: r.id } }}
                        className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-800"
                      >
                        체크인
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 요일 · 교시 picker */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <div className="text-xs text-zinc-500 mb-2">요일</div>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDay(d.key)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  day === d.key
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-2">교시</div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_CODES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  period === p
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            {date} · {periodLabel(period)}
          </p>
        </div>
      </section>

      {/* 빈 강의실 그리드 */}
      <section className="space-y-4">
        {loading ? (
          <div className="rounded-xl border border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
            불러오는 중...
          </div>
        ) : freeRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-10 text-center text-sm text-zinc-500">
            이 시간에는 비어 있는 강의실이 없어요.
          </div>
        ) : (
          Array.from(groups.entries()).map(([key, groupRooms]) => (
            <div key={key} className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {key}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {groupRooms.map((r) => (
                  <Link
                    key={r.code}
                    href={{
                      pathname: "/student/reserve",
                      query: { room: r.code, date, period },
                    }}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition hover:bg-emerald-100"
                  >
                    <div className="font-semibold text-zinc-900">{r.code}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {r.category ?? ""}
                    </div>
                    <div className="mt-3 text-xs font-medium text-emerald-700">
                      예약 →
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function QuickMenu({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-800 shadow-sm transition hover:bg-zinc-50"
    >
      <span className="text-xl" aria-hidden>{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
