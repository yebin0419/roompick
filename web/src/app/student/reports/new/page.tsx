import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import ReportNewClient from "./ReportNewClient";

export default async function NewReportPage() {
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
        <Link href="/student/reports" className="text-xs text-zinc-500 hover:underline">
          ← 신고 목록
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">새 신고</h1>
      </header>
      <ReportNewClient userId={user.id} />
    </div>
  );
}
