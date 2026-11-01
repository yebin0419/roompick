"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function uploadCard(userId: string): Promise<string | null> {
    if (!cardFile) return null;
    const ext = cardFile.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("student-cards").upload(path, cardFile, {
      contentType: cardFile.type || "image/jpeg",
      upsert: true,
    });
    if (up.error) throw up.error;
    return supabase.storage.from("student-cards").getPublicUrl(path).data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      if (mode === "signup") {
        if (!cardFile) throw new Error("학생증 사진을 첨부해주세요.");
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name, student_id: studentId, department } },
        });
        if (error) throw error;

        if (data.session && data.user) {
          // 세션이 바로 생긴 경우 (이메일 확인 비활성): 업로드까지 진행
          const url = await uploadCard(data.user.id);
          await supabase.from("profiles").update({
            name, student_id: studentId, department, student_card_url: url,
          }).eq("id", data.user.id);
          router.replace("/student");
          router.refresh();
        } else {
          // 이메일 확인 활성: 확인 후 로그인하면 verify 페이지로 안내
          setInfo("가입 완료. 이메일 인증을 완료한 뒤 로그인하면 학생증 사진이 업로드됩니다.");
          // 이메일 확인 완료 후 다시 접속하도록 파일은 유지하지 않음
          setCardFile(null);
          setMode("signin");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 로그인 폼에서 학생증 파일이 선택되어 있으면 함께 업로드
        if (cardFile && data.user) {
          const url = await uploadCard(data.user.id);
          await supabase.from("profiles").update({ student_card_url: url }).eq("id", data.user.id);
        }
        router.replace("/student");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
      <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); setInfo(null); }}
            className={`flex-1 py-2 rounded-lg transition ${
              mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
            type="button"
          >
            {m === "signin" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <>
            <Field label="이름" value={name} onChange={setName} required />
            <Field label="학번" value={studentId} onChange={setStudentId} required />
            <Field
              label="학과"
              value={department}
              onChange={setDepartment}
              placeholder="예: 경영학부, 국제경영학과"
              required
            />
          </>
        )}
        <Field label="이메일" type="email" value={email} onChange={setEmail} required />
        <Field label="비밀번호" type="password" value={password} onChange={setPassword} required />

        {mode === "signup" && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1.5">
              학생증 사진 <span className="text-red-500">*</span>
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setCardFile(e.target.files?.[0] ?? null)}
              required
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-white"
            />
            {cardFile && (
              <p className="mt-1 text-xs text-slate-500">선택됨: {cardFile.name}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              이미지 1장. 가입 후 운영진 승인이 완료되면 모든 기능이 열립니다.
            </p>
          </label>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {info && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-3 transition"
        >
          {loading ? "처리 중..." : mode === "signin" ? "로그인" : "가입 + 학생증 제출"}
        </button>
      </form>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1.5">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required={props.required}
        placeholder={props.placeholder}
        className="w-full rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none px-3.5 py-2.5 text-sm"
      />
    </label>
  );
}
