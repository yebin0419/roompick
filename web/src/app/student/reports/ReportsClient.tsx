"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CATEGORY_LABEL, REPORT_STATUS_LABEL } from "@/lib/reports";
import { createClient } from "@/lib/supabase/browser";
import type { Report, ReportStatus } from "@/lib/supabase/types";

type Props = {
  userId: string;
};

const STATUS_TONE: Record<ReportStatus, string> = {
  OPEN: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-zinc-100 text-zinc-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  DISMISSED: "bg-red-100 text-red-700",
};

export default function ReportsClient({ userId }: Props) {
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Report[]);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`my-reports:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reports",
          filter: `reporter_id=eq.${userId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <p className="text-sm text-zinc-500">무단 점유·비품 고장·청결 문제 등</p>
        <Link
          href="/student/reports/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
        >
          + 새 신고
        </Link>
      </div>

      {loading && (
        <div className="rounded-xl border border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
          불러오는 중...
        </div>
      )}
      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-10 text-center text-sm text-zinc-500">
          아직 접수한 신고가 없어요.
        </div>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900">
                  {CATEGORY_LABEL[r.category]}
                </span>
                {r.room_code && (
                  <span className="text-xs text-zinc-500">{r.room_code}</span>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_TONE[r.status]}`}
              >
                {REPORT_STATUS_LABEL[r.status]}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-zinc-700">{r.description}</p>
            <div className="mt-1 text-[11px] text-zinc-400">
              {new Date(r.created_at).toLocaleString("ko-KR")}
            </div>
            {r.resolution_note && (
              <div
                className={`mt-2 rounded-md px-3 py-1.5 text-xs ${
                  r.status === "DISMISSED"
                    ? "bg-red-50 text-red-800"
                    : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {r.status === "DISMISSED" ? "반려 사유" : "처리 메모"}: {r.resolution_note}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
