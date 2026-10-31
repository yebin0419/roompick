import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VerifyForm from "./VerifyForm";

export const metadata = { title: "학생증 인증 · 룸픽" };

export default async function VerifyPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, student_id, approval_status, student_card_url, rejection_reason")
    .eq("id", user.id).maybeSingle();

  if (profile?.approval_status === "APPROVED") redirect("/student");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">학생증 인증</h1>
      <p className="mt-1 text-slate-500 text-sm">
        안전한 사용 환경을 위해 학생증 사진을 1회 제출해주세요.
      </p>

      {profile?.approval_status === "PENDING" && profile.student_card_url && (
        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="font-medium text-amber-800">승인 대기 중</p>
          <p className="mt-1 text-sm text-amber-700">
            제출하신 학생증을 운영진이 확인 중입니다. 승인되면 자동으로 전체 기능이 열립니다.
          </p>
        </div>
      )}
      {profile?.approval_status === "REJECTED" && (
        <div className="mt-6 rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="font-medium text-red-800">반려되었습니다</p>
          {profile.rejection_reason && (
            <p className="mt-1 text-sm text-red-700">사유: {profile.rejection_reason}</p>
          )}
          <p className="mt-1 text-sm text-red-700">새 사진을 다시 업로드해주세요.</p>
        </div>
      )}

      <VerifyForm
        userId={user.id}
        existingName={profile?.name ?? ""}
        existingStudentId={profile?.student_id ?? ""}
      />
    </div>
  );
}
