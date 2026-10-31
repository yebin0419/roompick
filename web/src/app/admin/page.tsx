import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AdminIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // 행정실은 전용 대시보드로, 운영진은 학생증 승인함을 기본 랜딩으로
  if (profile?.role === "ADMIN") redirect("/admin/dashboard");
  redirect("/admin/students");
}
