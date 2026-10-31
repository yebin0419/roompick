"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

type Mode = "student-signin" | "student-signup" | "admin-signin";

const SUBTITLES: Record<Mode, string> = {
  "student-signin": "경영대 학생 전용. 로그인 후 학생증 승인을 거쳐 사용합니다.",
  "student-signup": "회원가입 후 학생증을 제출하면 운영진 승인을 받아요.",
  "admin-signin": "운영진·행정실 전용 사전 발급 계정 로그인",
};

const SUBMIT_LABELS: Record<Mode, string> = {
  "student-signin": "학생 로그인",
  "student-signup": "회원가입 후 학생증 제출",
  "admin-signin": "관리자 로그인",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") ?? undefined;

  const [mode, setMode] = useState<Mode>("student-signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const resetForm = () => {
    setErrorText(null);
    setPassword("");
    setName("");
    setStudentNumber("");
  };

  const switchMode = (next: Mode) => {
    resetForm();
    setMode(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorText(null);
    try {
      if (mode === "student-signup") {
        if (!name.trim() || !studentNumber.trim()) {
          throw new Error("이름과 학번을 입력해 주세요.");
        }
        if (password.length < 8) {
          throw new Error("비밀번호는 8자 이상이어야 합니다.");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim(), student_number: studentNumber.trim() } },
        });
        if (error) throw error;
        alert("회원가입이 완료되었습니다. 학생증을 제출해 주세요.");
        router.push("/student/verify");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (mode === "student-signin") {
        if (profile?.role !== "STUDENT") {
          await supabase.auth.signOut();
          throw new Error("학생 계정이 아닙니다. 관리자 로그인을 이용해 주세요.");
        }
        router.push(nextParam?.startsWith("/student") ? nextParam : "/student");
      } else {
        if (profile?.role !== "OPERATOR" && profile?.role !== "ADMIN") {
          await supabase.auth.signOut();
          throw new Error("관리자 권한이 없는 계정입니다.");
        }
        router.push(nextParam?.startsWith("/admin") ? nextParam : "/admin");
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const isAdminMode = mode === "admin-signin";
  const isSignUp = mode === "student-signup";

  return (
    <div className="w-full max-w-sm space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">룸픽 (RoomPick)</h1>
        <p className="text-sm text-zinc-500">{SUBTITLES[mode]}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        {isSignUp && (
          <>
            <Field label="이름" value={name} onChange={setName} autoComplete="name" autoFocus />
            <Field
              label="학번"
              value={studentNumber}
              onChange={setStudentNumber}
              inputMode="numeric"
              autoComplete="off"
            />
          </>
        )}

        <Field
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          autoFocus={!isSignUp}
        />

        <Field
          label={isSignUp ? "비밀번호 (8자 이상)" : "비밀번호"}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />

        {errorText && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {errorText}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "처리 중..." : SUBMIT_LABELS[mode]}
        </button>

        {!isAdminMode && (
          <p className="text-center text-sm text-zinc-500">
            {isSignUp ? (
              <>
                이미 계정이 있나요?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("student-signin")}
                  className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                >
                  학생 로그인
                </button>
              </>
            ) : (
              <>
                처음 방문하셨나요?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("student-signup")}
                  className="font-medium text-zinc-900 underline-offset-4 hover:underline"
                >
                  학생 회원가입하기
                </button>
              </>
            )}
          </p>
        )}
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-zinc-50 px-3 text-[11px] uppercase tracking-wider text-zinc-400">
            또는
          </span>
        </div>
      </div>

      {isAdminMode ? (
        <button
          type="button"
          onClick={() => switchMode("student-signin")}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          ← 학생 로그인으로 돌아가기
        </button>
      ) : (
        <button
          type="button"
          onClick={() => switchMode("admin-signin")}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          🔐 관리자 전용 로그인 (운영진 / 행정실)
        </button>
      )}
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "numeric" | "email" | "tel";
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  autoFocus,
  inputMode,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
      />
    </div>
  );
}
