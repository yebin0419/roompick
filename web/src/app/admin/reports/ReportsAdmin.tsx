"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Rp = {
  id: string; category: string; content: string; status: string;
  photo_url: string | null; created_at: string;
  reporter: { id: string; name: string | null; student_id: string | null; department: string | null } | null;
  room: { code: string; building: string | null; floor: string | null } | null;
};

const CAT: Record<string, string> = {
  BROKEN_EQUIPMENT: "비품 고장", CLEANLINESS: "청결", NO_SHOW: "노쇼", OTHER: "기타",
};

export default function ReportsAdmin({ items }: { items: Rp[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("OPEN");

  const list = items.filter((r) => filter === "ALL" ? true : filter === "OPEN"
    ? ["OPEN", "IN_PROGRESS"].includes(r.status) : r.status === "RESOLVED");

  async function updateStatus(r: Rp, status: string) {
    setBusy(r.id);
    await supabase.from("reports").update({ status }).eq("id", r.id);
    if (r.reporter?.id) {
      await supabase.from("notifications").insert({
        user_id: r.reporter.id,
        title: status === "RESOLVED" ? "신고가 처리되었습니다"
          : status === "DISMISSED" ? "신고가 반려되었습니다" : "신고가 접수되었습니다",
        body: `${CAT[r.category] ?? r.category} · ${r.room?.code ?? ""}`,
      });
    }
    setBusy(null); router.refresh();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">신고 처리</h1>
          <p className="mt-1 text-sm text-slate-500">
            고장·청결·노쇼 신고를 확인하고 처리 상태를 변경합니다.
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white text-sm">
          {(["OPEN", "RESOLVED", "ALL"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 ${filter === f ? "font-semibold text-slate-900" : "text-slate-500"}`}>
              {f === "OPEN" ? "진행" : f === "RESOLVED" ? "완료" : "전체"}
            </button>
          ))}
        </div>
      </header>

      <p className="text-xs text-slate-400">전체 {items.length}건 · 현재 탭 {list.length}건</p>

      <ul className="grid gap-3 lg:grid-cols-2">
        {list.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {r.room?.code ?? "(강의실 미지정)"}
                  {r.room?.building && (
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      · {r.room.building}동 {r.room.floor}
                    </span>
                  )}
                  <span className="ml-2 text-sm font-normal text-slate-600">
                    · {CAT[r.category] ?? r.category}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {r.reporter?.name ?? "(이름 없음)"}
                  {r.reporter?.student_id && ` (${r.reporter.student_id})`}
                  {r.reporter?.department && ` · ${r.reporter.department}`}
                  {" · "}
                  {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                </p>
              </div>
              <ReportStatusChip status={r.status} />
            </div>
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{r.content}</p>
            {r.photo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={r.photo_url} alt="" className="mt-3 rounded-xl max-h-48 w-full object-contain bg-slate-100" />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status !== "RESOLVED" && (
                <button disabled={busy === r.id} onClick={() => updateStatus(r, "RESOLVED")}
                  className="text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5">
                  처리 완료
                </button>
              )}
              {r.status === "OPEN" && (
                <button disabled={busy === r.id} onClick={() => updateStatus(r, "IN_PROGRESS")}
                  className="text-xs rounded-md border border-slate-200 px-3 py-1.5">
                  진행 중
                </button>
              )}
              {r.status !== "DISMISSED" && (
                <button disabled={busy === r.id} onClick={() => updateStatus(r, "DISMISSED")}
                  className="text-xs rounded-md border border-red-200 text-red-600 px-3 py-1.5">
                  반려
                </button>
              )}
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-slate-500 lg:col-span-2 py-6 text-center">
            조건에 맞는 신고가 없습니다.
          </p>
        )}
      </ul>
    </div>
  );
}

function ReportStatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: "bg-amber-50 text-amber-700",
    IN_PROGRESS: "bg-blue-50 text-blue-700",
    RESOLVED: "bg-emerald-50 text-emerald-700",
    DISMISSED: "bg-slate-100 text-slate-500",
  };
  const label: Record<string, string> = {
    OPEN: "접수", IN_PROGRESS: "처리중", RESOLVED: "완료", DISMISSED: "반려",
  };
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${map[status] ?? "bg-slate-100"}`}>
      {label[status] ?? status}
    </span>
  );
}
