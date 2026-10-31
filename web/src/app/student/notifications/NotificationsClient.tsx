"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/browser";
import type { AppNotification } from "@/lib/supabase/types";

type Props = { userId: string };

function studentLinkFromData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const roomCode = typeof d.room_code === "string" ? d.room_code : null;
  const date = typeof d.date === "string" ? d.date : null;
  const startPeriod = typeof d.start_period === "string" ? d.start_period : null;
  if (roomCode && date && startPeriod) {
    const q = new URLSearchParams({ room: roomCode, date, period: startPeriod });
    return `/student/reserve?${q}`;
  }
  const reservationId = typeof d.reservation_id === "string" ? d.reservation_id : null;
  if (reservationId) return `/student`;
  return null;
}

export default function NotificationsClient({ userId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data ?? []) as AppNotification[]);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`student-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  // 진입 시 모두 읽음
  useEffect(() => {
    if (!loading && rows.some((r) => !r.read_at)) {
      supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null)
        .then(() => {
          /* no-op */
        });
    }
  }, [supabase, userId, rows, loading]);

  return (
    <div className="space-y-2">
      {loading && (
        <div className="rounded-xl border border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
          불러오는 중...
        </div>
      )}
      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-10 text-center text-sm text-zinc-500">
          아직 받은 알림이 없어요.
        </div>
      )}
      {rows.map((n) => {
        const href = studentLinkFromData(n.data);
        const unread = !n.read_at;
        const inner = (
          <div
            className={`rounded-xl border px-4 py-3 shadow-sm transition ${
              unread ? "border-blue-200 bg-blue-50" : "border-zinc-200 bg-white"
            } ${href ? "hover:bg-zinc-50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900">{n.title}</span>
                {unread && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              </div>
              <span className="text-[11px] text-zinc-400">
                {new Date(n.created_at).toLocaleString("ko-KR")}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-700">{n.body}</p>
          </div>
        );
        return (
          <div key={n.id}>
            {href ? <Link href={href}>{inner}</Link> : inner}
          </div>
        );
      })}
    </div>
  );
}
