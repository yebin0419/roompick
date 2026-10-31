import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import NotificationsClient from "./NotificationsClient";

export default async function StudentNotifications() {
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
        <h1 className="text-xl font-semibold tracking-tight">알림</h1>
        <p className="mt-1 text-sm text-zinc-500">
          예약 승인·종료 임박·맞춤 빈자리 등 최근 100건.
        </p>
      </header>
      <NotificationsClient userId={user.id} />
    </div>
  );
}
