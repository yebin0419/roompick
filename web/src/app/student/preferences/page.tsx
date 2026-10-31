import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import PreferencesClient from "./PreferencesClient";

export default async function StudentPreferences() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status, name, student_number")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "STUDENT") redirect("/login?error=forbidden");
  if (profile.approval_status !== "APPROVED") redirect("/student");

  return (
    <div className="mx-auto max-w-xl px-6 py-8 space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">마이페이지</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {profile.name ?? "학생"}님 · 학번 {profile.student_number ?? "-"}
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">맞춤 빈자리 알림</h2>
        <p className="mt-1 text-xs text-zinc-500">
          선호 강의실·교시가 비면 즉시 알림을 받아요.
        </p>
      </section>

      <PreferencesClient userId={user.id} />
    </div>
  );
}
