import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

import ReserveForm from "./ReserveForm";

export const dynamic = "force-dynamic";

export default async function ReservePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "STUDENT") redirect("/login?error=forbidden");
  if (profile.approval_status !== "APPROVED") redirect("/student");

  return (
    <div className="mx-auto max-w-xl px-6 py-8 space-y-6">
      <header>
        <Link href="/student" className="text-xs text-zinc-500 hover:underline">
          ← 빈 강의실
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">예약하기</h1>
        <p className="mt-1 text-sm text-zinc-500">
          선택한 강의실·날짜·교시를 확인하고 제출해 주세요.
        </p>
      </header>

      <Suspense
        fallback={<div className="text-sm text-zinc-400">로딩 중...</div>}
      >
        <ReserveForm userId={user.id} />
      </Suspense>
    </div>
  );
}
