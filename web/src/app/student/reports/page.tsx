import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import ReportsClient from "./ReportsClient";

export default async function StudentReports() {
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
        <h1 className="text-xl font-semibold tracking-tight">신고</h1>
      </header>
      <ReportsClient userId={user.id} />
    </div>
  );
}
