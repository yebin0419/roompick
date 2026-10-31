import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

import CheckInClient from "./CheckInClient";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
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
    <div className="mx-auto max-w-xl px-6 py-8 space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">체크인</h1>
        <p className="mt-1 text-sm text-zinc-500">
          경영대 범위 안에서 현장 사진 1장과 함께 체크인해 주세요.
        </p>
      </header>
      <Suspense fallback={<div className="text-sm text-zinc-400">로딩 중...</div>}>
        <CheckInClient userId={user.id} />
      </Suspense>
    </div>
  );
}
