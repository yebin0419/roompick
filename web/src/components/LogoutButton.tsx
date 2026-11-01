"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LogoutButton({
  className = "text-xs text-slate-500 hover:text-slate-800 underline underline-offset-4",
  children = "로그아웃",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      // 세션 쿠키/서버 캐시 모두 비우기 위해 전체 리로드
      window.location.href = "/login";
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={className}>
      {loading ? "로그아웃 중..." : children}
    </button>
  );
}
