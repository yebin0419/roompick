"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/browser";

type Props = {
  // Supabase Realtime 구독 대상
  table: string;
  // 선택: postgres filter 문법 — "column=eq.value" 등
  filter?: string;
  // 선택: 채널 키를 분리하기 위한 명시적 식별자 (같은 테이블 여러 구독 시)
  channelKey?: string;
  // 선택: refresh 쓰로틀 간격 (ms). 기본 500ms — 폭발적 변경 시 과도한 refresh 방지
  throttleMs?: number;
};

export function RealtimeRefresher({ table, filter, channelKey, throttleMs = 500 }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let lastFiredAt = 0;
    let pending: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      const now = Date.now();
      const since = now - lastFiredAt;
      if (since >= throttleMs) {
        lastFiredAt = now;
        router.refresh();
      } else if (!pending) {
        pending = setTimeout(() => {
          pending = null;
          lastFiredAt = Date.now();
          router.refresh();
        }, throttleMs - since);
      }
    };

    const channel = supabase
      .channel(`refresh:${channelKey ?? `${table}:${filter ?? "*"}`}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        refresh,
      )
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, [table, filter, channelKey, throttleMs, router]);

  return null;
}
