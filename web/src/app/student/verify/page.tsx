import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

import UploadCard from "./UploadCard";

export default async function StudentVerify() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status, rejected_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "STUDENT") {
    redirect("/login?error=forbidden");
  }

  if (profile.approval_status === "APPROVED") {
    redirect("/student");
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">학생증을 인증해주세요</h1>
        <p className="text-sm text-zinc-500">
          운영진 승인을 위해 학생증 사진(또는 재학증명서)을 첨부해 주세요.
        </p>
      </header>

      {profile.rejected_reason && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-semibold">이전 거절 사유</div>
          <div className="mt-1">{profile.rejected_reason}</div>
        </div>
      )}

      <UploadCard userId={user.id} />

      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
        <li>이름·학번·학과가 선명하게 보이는 전체 사진으로 올려주세요.</li>
        <li>제출 후 운영진이 승인하면 자동으로 전환됩니다.</li>
        <li>거절되면 사유와 함께 재제출 안내가 전달됩니다.</li>
      </ul>

      <div className="flex gap-3">
        <Link
          href="/student"
          className="flex-1 rounded-lg border border-zinc-300 bg-white py-3 text-center text-sm text-zinc-700 hover:bg-zinc-50"
        >
          학생 홈으로
        </Link>
        <form action={signOut} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-300 bg-white py-3 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
