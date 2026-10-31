"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PERIOD_CODES, periodLabel } from "@/lib/periods";
import { createClient } from "@/lib/supabase/browser";
import type { Room, StudentPreference } from "@/lib/supabase/types";

type Props = { userId: string };

export default function PreferencesClient({ userId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [roomRes, prefRes] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("in_scope", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("student_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    setRooms(roomRes.data ?? []);
    const pref = prefRes.data as StudentPreference | null;
    if (pref) {
      setSelectedRooms(new Set(pref.preferred_rooms));
      setSelectedPeriods(new Set(pref.preferred_periods));
      setActive(pref.active);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRoom = (code: string) => {
    const next = new Set(selectedRooms);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelectedRooms(next);
  };
  const togglePeriod = (code: string) => {
    const next = new Set(selectedPeriods);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelectedPeriods(next);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorText(null);
    const { error } = await supabase.from("student_preferences").upsert({
      user_id: userId,
      preferred_rooms: Array.from(selectedRooms),
      preferred_periods: Array.from(selectedPeriods),
      active,
    });
    setSaving(false);
    if (error) {
      setErrorText(error.message);
    } else {
      setSavedAt(new Date());
    }
  };

  // 건물/층 그룹
  const groups = new Map<string, Room[]>();
  for (const r of rooms) {
    const key = `${r.building} · ${r.floor ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
        불러오는 중...
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">알림 활성</h3>
          <p className="mt-1 text-xs text-zinc-500">
            선택한 강의실·교시가 비면 즉시 푸시 알림이 발사됩니다.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="peer sr-only"
          />
          <span className="h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-emerald-500 relative">
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
          </span>
        </label>
      </section>

      <Section
        title={`선호 강의실 (${selectedRooms.size})`}
        subtitle="관심 있는 강의실을 모두 선택하세요."
      >
        {Array.from(groups.entries()).map(([key, groupRooms]) => (
          <div key={key} className="mb-3 last:mb-0">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">
              {key}
            </div>
            <div className="flex flex-wrap gap-2">
              {groupRooms.map((r) => {
                const picked = selectedRooms.has(r.code);
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => toggleRoom(r.code)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      picked
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {r.code}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      <Section
        title={`선호 교시 (${selectedPeriods.size})`}
        subtitle="미선택 시 모든 교시 매칭."
      >
        <div className="flex flex-wrap gap-2">
          {PERIOD_CODES.map((p) => {
            const picked = selectedPeriods.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePeriod(p)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  picked
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
        {selectedPeriods.size > 0 && (
          <p className="mt-2 text-[11px] text-zinc-400">
            {Array.from(selectedPeriods).sort().map(periodLabel).join(" · ")}
          </p>
        )}
      </Section>

      {errorText && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorText}
        </p>
      )}
      {savedAt && !errorText && (
        <p className="text-xs text-emerald-700">
          저장됨 · {savedAt.toLocaleTimeString("ko-KR")}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "저장 중..." : "저장"}
      </button>

      <p className="text-center text-[11px] text-zinc-400">
        알림은 오늘·내일 날짜의 예약 취소 시에만 발송됩니다.
      </p>
    </form>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
