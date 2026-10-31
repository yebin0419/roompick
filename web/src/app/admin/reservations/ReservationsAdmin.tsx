"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type R = {
  id: string; start_time: string; end_time: string;
  status: string; purpose: string | null; is_event: boolean;
  user: { id: string; name: string | null; student_id: string | null } | null;
  room: { id: string; code: string } | null;
};

export default function ReservationsAdmin({ items }: { items: R[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "EVENT" | "ACTIVE">("ALL");

  const list = items.filter((r) => {
    if (filter === "EVENT") return r.is_event;
    if (filter === "ACTIVE") return ["RESERVED", "CHECKED_IN"].includes(r.status);
    return true;
  });

  async function updateStatus(id: string, status: string, notifyUserId?: string, title?: string) {
    setBusy(id);
    await supabase.from("reservations").update({ status }).eq("id", id);
    if (notifyUserId && title) {
      await supabase.from("notifications").insert({ user_id: notifyUserId, title });
    }
    setBusy(null); router.refresh();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">예약 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            행사 예약 승인, 강제 취소, 노쇼 처리를 할 수 있습니다.
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white text-sm">
          {(["ALL", "ACTIVE", "EVENT"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 ${filter === f ? "font-semibold text-slate-900" : "text-slate-500"}`}>
              {f === "ALL" ? "전체" : f === "ACTIVE" ? "진행중" : "행사"}
            </button>
          ))}
        </div>
      </header>

      <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500 bg-slate-50">
            <tr>
              <th className="py-2.5 px-3 font-medium">학생</th>
              <th className="py-2.5 px-3 font-medium">강의실</th>
              <th className="py-2.5 px-3 font-medium">시간</th>
              <th className="py-2.5 px-3 font-medium">용도</th>
              <th className="py-2.5 px-3 font-medium">상태</th>
              <th className="py-2.5 px-3 font-medium">작업</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-2.5 px-3">
                  <div>{r.user?.name ?? "-"}</div>
                  <div className="text-xs text-slate-400">{r.user?.student_id}</div>
                </td>
                <td className="py-2.5 px-3">{r.room?.code}</td>
                <td className="py-2.5 px-3 text-slate-600">
                  {new Date(r.start_time).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" ~ "}
                  {new Date(r.end_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {r.purpose}{r.is_event && <span className="ml-1 text-xs text-brand-500">(행사)</span>}
                </td>
                <td className="py-2.5 px-3">
                  <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5">{r.status}</span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex flex-wrap gap-1">
                    {r.is_event && r.status === "RESERVED" && (
                      <button
                        disabled={busy === r.id}
                        onClick={() => updateStatus(r.id, "RESERVED", r.user?.id, "행사 예약이 승인되었습니다")}
                        className="text-xs rounded-md border border-emerald-200 text-emerald-700 px-2 py-1"
                      >
                        승인
                      </button>
                    )}
                    {["RESERVED", "CHECKED_IN"].includes(r.status) && (
                      <>
                        <button
                          disabled={busy === r.id}
                          onClick={() => updateStatus(r.id, "CANCELLED", r.user?.id, "예약이 취소되었습니다")}
                          className="text-xs rounded-md border border-slate-200 text-slate-600 px-2 py-1"
                        >
                          취소
                        </button>
                        <button
                          disabled={busy === r.id}
                          onClick={() => updateStatus(r.id, "NO_SHOW", r.user?.id, "노쇼로 처리되었습니다")}
                          className="text-xs rounded-md border border-red-200 text-red-600 px-2 py-1"
                        >
                          노쇼
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">해당하는 예약이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
