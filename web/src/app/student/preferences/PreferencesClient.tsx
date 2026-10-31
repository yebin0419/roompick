"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type P = {
  name: string | null; email: string; student_id: string | null;
  approval_status: string; student_card_url: string | null; role: string;
};

export default function PreferencesClient({ profile }: { profile: P }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(profile.name ?? "");
  const [studentId, setStudentId] = useState(profile.student_id ?? "");
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function save() {
    setSaving(true); setInfo(null);
    const { error } = await supabase.from("profiles").update({ name, student_id: studentId })
      .eq("email", profile.email);
    setSaving(false);
    setInfo(error ? error.message : "저장되었습니다.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">마이페이지</h1>
        <p className="mt-1 text-sm text-slate-500">계정 정보 및 승인 상태</p>
      </header>

      <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">상태</span>
          <StatusChip status={profile.approval_status} />
        </div>
        <Field label="이름" value={name} onChange={setName} />
        <Field label="학번" value={studentId} onChange={setStudentId} />
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

      {profile.student_card_url && (
        <section className="rounded-2xl bg-white border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-900">제출한 학생증</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.student_card_url} alt="학생증" className="mt-3 rounded-xl max-h-72" />
        </section>
      )}

      <form action="/auth/signout" method="post">
        <button className="w-full rounded-xl bg-white border border-slate-200 text-slate-700 py-3 font-medium">
          로그아웃
        </button>
      </form>
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
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white read-only:bg-slate-50"
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
