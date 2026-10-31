"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { PERIOD_CODES, periodLabel, periodRangeLabel } from "@/lib/periods";
import { createClient } from "@/lib/supabase/browser";
import type { ReservationKind } from "@/lib/supabase/types";

type Props = {
  userId: string;
};

export default function ReserveForm({ userId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const room = searchParams.get("room") ?? "";
  const date = searchParams.get("date") ?? "";
  const initialPeriod =
    searchParams.get("period") && PERIOD_CODES.includes(searchParams.get("period")!)
      ? searchParams.get("period")!
      : "01";

  const [start, setStart] = useState(initialPeriod);
  const [end, setEnd] = useState(initialPeriod);
  const [attendees, setAttendees] = useState("4");
  const [purpose, setPurpose] = useState("");
  const [kind, setKind] = useState<ReservationKind>("QUICK");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const span = useMemo(() => {
    const si = PERIOD_CODES.indexOf(start);
    const ei = PERIOD_CODES.indexOf(end);
    return ei >= si ? ei - si + 1 : 0;
  }, [start, end]);
  const attendeesNum = Number(attendees) || 0;
  const predictedAuto =
    kind === "QUICK" && attendeesNum > 0 && attendeesNum <= 10 && span > 0 && span <= 2;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !date) {
      setErrorText("강의실·날짜 정보가 없습니다.");
      return;
    }
    if (!purpose.trim()) {
      setErrorText("사용 목적을 입력해 주세요.");
      return;
    }
    if (attendeesNum <= 0) {
      setErrorText("예상 인원을 입력해 주세요.");
      return;
    }
    if (span <= 0) {
      setErrorText("종료 교시가 시작 교시보다 빠릅니다.");
      return;
    }

    setBusy(true);
    setErrorText(null);
    const { error } = await supabase.from("reservations").insert({
      student_id: userId,
      room_code: room,
      reservation_date: date,
      start_period: start,
      end_period: end,
      attendees: attendeesNum,
      purpose: purpose.trim(),
      kind,
    });
    setBusy(false);

    if (error) {
      setErrorText(error.message);
      return;
    }

    alert(
      predictedAuto
        ? "자동 승인되었습니다. 홈에서 확인하세요."
        : kind === "EVENT"
          ? "행정실 승인 대기 상태로 접수되었습니다."
          : "운영진 승인 대기 상태로 접수되었습니다.",
    );
    router.push("/student");
  };

  if (!room || !date) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        강의실·날짜 정보가 없습니다. 홈에서 다시 선택해 주세요.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* 요약 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-base font-semibold text-zinc-900">{room}</div>
        <div className="mt-1 text-sm text-zinc-500">
          {date} · {periodRangeLabel(start, end)}교시
        </div>
      </section>

      <Panel title="시작 교시">
        <PeriodPills value={start} onChange={(v) => {
          setStart(v);
          if (PERIOD_CODES.indexOf(v) > PERIOD_CODES.indexOf(end)) setEnd(v);
        }} />
      </Panel>

      <Panel title="종료 교시">
        <PeriodPills value={end} onChange={setEnd} />
        <p className="mt-2 text-[11px] text-zinc-400">
          {periodLabel(start)} ~ {periodLabel(end)} · {span}교시
        </p>
      </Panel>

      <Panel title="예상 인원">
        <input
          type="number"
          min={1}
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </Panel>

      <Panel title="사용 목적">
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="팀플 / 스터디 / 행사 등"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
      </Panel>

      <Panel title="예약 종류">
        <div className="grid grid-cols-2 gap-2">
          <KindOption
            active={kind === "QUICK"}
            onClick={() => setKind("QUICK")}
            title="소규모 (QUICK)"
            subtitle="10명↓ · 2교시↓ 자동 승인"
          />
          <KindOption
            active={kind === "EVENT"}
            onClick={() => setKind("EVENT")}
            title="대규모·행사 (EVENT)"
            subtitle="행정실 최종 승인"
          />
        </div>
      </Panel>

      <div
        className={`rounded-lg px-4 py-3 text-sm font-medium ${
          predictedAuto
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-800"
        }`}
      >
        {predictedAuto
          ? "제출하면 자동 승인됩니다"
          : kind === "EVENT"
            ? "행정실 승인 후 사용 가능합니다"
            : "운영진 승인 후 사용 가능합니다"}
      </div>

      {errorText && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "제출 중..." : "예약 요청"}
      </button>
    </form>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PeriodPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERIOD_CODES.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            value === p
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function KindOption({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
      }`}
    >
      <div className="font-semibold">{title}</div>
      <div
        className={`mt-1 text-[11px] ${active ? "text-white/75" : "text-zinc-500"}`}
      >
        {subtitle}
      </div>
    </button>
  );
}
