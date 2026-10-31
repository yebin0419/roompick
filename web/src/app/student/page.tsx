import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export default async function StudentHome() {
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

  if (!profile || profile.role !== "STUDENT") {
    redirect("/login?error=forbidden");
  }

  const needsVerify = profile.approval_status === "PENDING";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-16 text-center">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          안녕하세요, {profile.name ?? "학생"}님
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          학번 {profile.student_number ?? "-"} · 상태{" "}
          <span
            className={
              profile.approval_status === "APPROVED"
                ? "text-emerald-700"
                : profile.approval_status === "REJECTED"
                  ? "text-red-700"
                  : "text-amber-700"
            }
          >
            {profile.approval_status}
          </span>
        </p>
      </header>

      <section className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-3 text-left">
        <h2 className="text-sm font-semibold text-zinc-800">학생 기능은 모바일 앱에서</h2>
        <p className="text-sm text-zinc-600">
          빈 강의실 조회, 예약, 체크인, 신고 등 모든 학생 기능은 룸픽 모바일 앱에서
          제공됩니다. Expo Go 또는 설치 빌드로 접속해 주세요.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
          <li>GPS 체크인은 모바일 전용입니다</li>
          <li>푸시 알림(승인·종료 임박·맞춤 빈자리)도 모바일에서 수신</li>
        </ul>
      </section>

      {needsVerify && (
        <Link
          href="/student/verify"
          className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          학생증 제출하러 가기 →
        </Link>
      )}

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-6 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
