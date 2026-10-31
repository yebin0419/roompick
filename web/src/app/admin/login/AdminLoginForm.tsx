"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function AdminLoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", data.user!.id).maybeSingle();
      if (profile?.role !== "ADMIN" && profile?.role !== "OPERATOR") {
        await supabase.auth.signOut();
        throw new Error("관리자 권한이 없는 계정입니다.");
      }
      router.replace("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">관리자 로그인</h1>
      <p className="mt-1 text-sm text-slate-500">
        행정실 · 운영진 전용 접속입니다.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1.5">이메일</span>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full rounded-xl border border-slate-200 focus:border-slate-700 focus:ring-2 focus:ring-slate-700/10 outline-none px-3.5 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1.5">비밀번호</span>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="w-full rounded-xl border border-slate-200 focus:border-slate-700 focus:ring-2 focus:ring-slate-700/10 outline-none px-3.5 py-2.5 text-sm"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="submit" disabled={loading}
          className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium py-3 transition"
        >
          {loading ? "처리 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
