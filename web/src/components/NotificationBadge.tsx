"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

type Props = {
  userId: string;
  initial: number;
};

export function NotificationBadge({ userId, initial }: Props) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    setCount(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();

    // 미읽음 재집계 (낙관적 반영 대신 조회가 가장 정확)
    const refetch = async () => {
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      setCount(c ?? 0);
    };

    const channel = supabase
      .channel(`notifications-badge:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        refetch,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (count <= 0) return null;
  return (
    <span className="min-w-[20px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
