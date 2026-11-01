"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type P = {
  id: string; name: string | null; student_id: string | null;
  department: string | null; email: string;
  approval_status: string; student_card_url: string | null; rejection_reason: string | null;
  created_at: string;
};

export default function VerificationsClient({ items }: { items: P[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(id: string) {
    setBusy(id);
    await supabase.from("profiles").update({ approval_status: "APPROVED" }).eq("id", id);
    await supabase.from("notifications").insert({
      user_id: id, title: "학생증 승인 완료", body: "이제 모든 기능을 사용할 수 있습니다.",
      link: "/student",
    });
    setBusy(null); router.refresh();
  }
  async function reject(id: string) {
    const reason = prompt("반려 사유를 입력하세요") ?? "";
    if (!reason) return;
    setBusy(id);
    await supabase.from("profiles").update({ approval_status: "REJECTED", rejection_reason: reason }).eq("id", id);
    await supabase.from("notifications").insert({
      user_id: id, title: "학생증 승인 반려", body: reason, link: "/student/verify",
    });
    setBusy(null); router.refresh();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">학생증 승인</h1>
        <p className="mt-1 text-sm text-slate-500">
          학번과 사진을 대조한 뒤 승인 또는 반려 처리하세요.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((p) => (
          <li key={p.id} className="rounded-2xl bg-white border border-slate-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">{p.name ?? "(이름 없음)"}</p>
                <p className="text-xs text-slate-500">
                  {p.student_id}
                  {p.department && <> · {p.department}</>}
                </p>
                <p className="text-xs text-slate-400">{p.email}</p>
              </div>
              <span className={`text-xs rounded-full px-2 py-0.5 ${
                p.approval_status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
              }`}>
                {p.approval_status === "REJECTED" ? "반려됨" : "대기"}
              </span>
            </div>

            {p.student_card_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.student_card_url} alt="학생증" className="mt-3 rounded-xl max-h-56 w-full object-contain bg-slate-100" />
            ) : (
              <p className="mt-3 text-sm text-slate-500">아직 사진이 업로드되지 않았습니다.</p>
            )}

            {p.rejection_reason && (
              <p className="mt-2 text-xs text-red-600">반려 사유: {p.rejection_reason}</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => approve(p.id)} disabled={busy === p.id || !p.student_card_url}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white py-2 text-sm font-medium"
              >
                승인
              </button>
              <button
                onClick={() => reject(p.id)} disabled={busy === p.id}
                className="rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2 text-sm font-medium"
              >
                반려
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-slate-500 col-span-2">대기 중인 승인 건이 없습니다.</p>
        )}
      </ul>
    </div>
  );
}
