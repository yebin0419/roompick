"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import LogoutButton from "@/components/LogoutButton";
import ReservationActions from "@/components/ReservationActions";

type P = {
  name: string | null; email: string; student_id: string | null;
  department: string | null;
  approval_status: string; student_card_url: string | null; role: string;
};

type Reservation = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  purpose: string | null;
  is_event: boolean;
  room: { code: string; building: string; floor: string | null } | null;
};

type Report = {
  id: string;
  category: string;
  content: string;
  status: string;
  created_at: string;
  photo_url: string | null;
  room: { code: string } | null;
};

export default function PreferencesClient({
  profile, reservations, reports,
}: {
  profile: P;
  reservations: Reservation[];
  reports: Report[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(profile.name ?? "");
  const [studentId, setStudentId] = useState(profile.student_id ?? "");
  const [department, setDepartment] = useState(profile.department ?? "");
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function save() {
    setSaving(true); setInfo(null);
    const { error } = await supabase.from("profiles")
      .update({ name, student_id: studentId, department })
      .eq("email", profile.email);
    setSaving(false);
    setInfo(error ? error.message : "저장되었습니다.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">마이페이지</h1>
        <p className="mt-1 text-sm text-slate-500">계정 정보 · 예약/신고 기록</p>
      </header>

      <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">상태</span>
          <StatusChip status={profile.approval_status} />
        </div>
        <Field label="이름" value={name} onChange={setName} />
        <Field label="학번" value={studentId} onChange={setStudentId} />
        <Field label="학과" value={department} onChange={setDepartment} />
        <Field label="이메일" value={profile.email} readOnly />

        {info && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {info}
          </p>
        )}
        <button
          onClick={save} disabled={saving}
          className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium py-3"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">내 예약 기록</h2>
          <span className="text-xs text-slate-400">최근 {reservations.length}건</span>
        </div>
        <ul className="mt-3 space-y-2">
          {reservations.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-100 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {r.room?.code ?? "-"}
                  {r.is_event && <span className="ml-1 text-xs text-brand-500">(행사)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {formatRange(r.start_time, r.end_time)}
                  {r.purpose && ` · ${r.purpose}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ReservationChip status={r.status} />
                <ReservationActions id={r.id} status={r.status} />
              </div>
            </li>
          ))}
          {reservations.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">
              최근 예약 내역이 없습니다.
            </p>
          )}
        </ul>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">신고 접수 현황</h2>
          <span className="text-xs text-slate-400">최근 {reports.length}건</span>
        </div>
        <ul className="mt-3 space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">
                  {r.room?.code ?? "-"} · {CATEGORY_LABEL[r.category] ?? r.category}
                </p>
                <ReportChip status={r.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{r.content}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
              </p>
            </li>
          ))}
          {reports.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">
              최근 신고 내역이 없습니다.
            </p>
          )}
        </ul>
      </section>

      {profile.student_card_url && (
        <section className="rounded-2xl bg-white border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-900">제출한 학생증</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.student_card_url} alt="학생증" className="mt-3 rounded-xl max-h-72" />
        </section>
      )}

      <LogoutButton className="w-full rounded-xl bg-white border border-slate-200 text-slate-700 py-3 font-medium hover:bg-slate-50" />
    </div>
  );
}

function Field(props: {
  label: string; value: string; onChange?: (v: string) => void; readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1.5">{props.label}</span>
      <input
        type="text" value={props.value} readOnly={props.readOnly}
        onChange={(e) => props.onChange?.(e.target.value)}
        className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white read-only:bg-slate-50"
      />
    </label>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
  };
  const label: Record<string, string> = {
    PENDING: "승인 대기", APPROVED: "승인 완료", REJECTED: "반려",
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${map[status] ?? "bg-slate-100"}`}>
      {label[status] ?? status}
    </span>
  );
}

function ReservationChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    RESERVED: "bg-blue-50 text-blue-700",
    CHECKED_IN: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-500",
    COMPLETED: "bg-slate-100 text-slate-500",
    NO_SHOW: "bg-red-50 text-red-700",
  };
  const label: Record<string, string> = {
    RESERVED: "예약 중", CHECKED_IN: "입실", CANCELLED: "취소", COMPLETED: "완료", NO_SHOW: "노쇼",
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${map[status] ?? "bg-slate-100"}`}>
      {label[status] ?? status}
    </span>
  );
}

function ReportChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: "bg-amber-50 text-amber-700",
    IN_PROGRESS: "bg-blue-50 text-blue-700",
    RESOLVED: "bg-emerald-50 text-emerald-700",
    DISMISSED: "bg-slate-100 text-slate-500",
  };
  const label: Record<string, string> = {
    OPEN: "접수 완료", IN_PROGRESS: "처리 중", RESOLVED: "조치 완료", DISMISSED: "반려",
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${map[status] ?? "bg-slate-100"}`}>
      {label[status] ?? status}
    </span>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  BROKEN_EQUIPMENT: "비품 고장",
  CLEANLINESS: "청결",
  NO_SHOW: "노쇼",
  OTHER: "기타",
};

function formatRange(startIso: string, endIso: string): string {
  const tz = "Asia/Seoul";
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString("ko-KR", {
    timeZone: tz, month: "numeric", day: "numeric", weekday: "short",
  });
  const s = start.toLocaleTimeString("ko-KR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const e = end.toLocaleTimeString("ko-KR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  return `${date} · ${s} ~ ${e}`;
}
