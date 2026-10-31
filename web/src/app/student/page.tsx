import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import StudentHomeClient from "./StudentHomeClient";

export default async function StudentHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status, name, student_number, rejected_reason")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "STUDENT") redirect("/login?error=forbidden");

  if (profile.approval_status === "APPROVED") {
    return (
      <StudentHomeClient
        userId={user.id}
        name={profile.name}
        studentNumber={profile.student_number}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-16 text-center">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          안녕하세요, {profile.name ?? "학생"}님
        </h1>
        <p className="mt-2 text-sm text-zinc-500">학번 {profile.student_number ?? "-"}</p>
      </header>

      {profile.approval_status === "PENDING" ? (
        <section className="w-full rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm text-left space-y-2">
          <h2 className="text-sm font-semibold text-amber-900">학생증 승인 대기 중</h2>
          <p className="text-sm text-amber-800">
            운영진이 학번과 학생증을 대조하고 있어요. 승인되면 전체 기능이 열립니다.
          </p>
        </section>
      ) : (
        <section className="w-full rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm text-left space-y-2">
          <h2 className="text-sm font-semibold text-red-900">학생증이 거절되었어요</h2>
          {profile.rejected_reason && (
            <p className="text-sm text-red-800">사유: {profile.rejected_reason}</p>
          )}
          <p className="text-xs text-red-700">아래 버튼으로 다시 제출해 주세요.</p>
        </section>
      )}

      <Link
        href="/student/verify"
        className="w-full rounded-lg bg-zinc-900 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800"
      >
        학생증 {profile.approval_status === "REJECTED" ? "재제출" : "제출"}하러 가기 →
      </Link>
    </div>
  );
}
