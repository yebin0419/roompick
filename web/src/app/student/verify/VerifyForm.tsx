"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function VerifyForm(props: {
  userId: string;
  existingName: string;
  existingStudentId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(props.existingName);
  const [studentId, setStudentId] = useState(props.existingStudentId);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError("학생증 사진을 선택해주세요."); return; }
    setLoading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${props.userId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("student-cards").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("student-cards").getPublicUrl(path);
      const { error: upErr } = await supabase.from("profiles").update({
        name, student_id: studentId, student_card_url: pub.publicUrl,
      }).eq("id", props.userId);
      if (upErr) throw upErr;
      setDone(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
        <p className="font-medium text-emerald-800">제출 완료</p>
        <p className="mt-1 text-sm text-emerald-700">
          운영진의 승인 후 자동으로 전체 기능이 열립니다. 알림을 확인해주세요.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl bg-white border border-slate-200 p-5">
      <Field label="이름" value={name} onChange={setName} required />
      <Field label="학번" value={studentId} onChange={setStudentId} required />

      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1.5">학생증 사진</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-white"
        />
        {file && <p className="mt-1 text-xs text-slate-500">선택됨: {file.name}</p>}
      </label>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit" disabled={loading}
        className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-3 transition"
      >
        {loading ? "업로드 중..." : "제출하기"}
      </button>
    </form>
  );
}

function Field(props: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1.5">{props.label}</span>
      <input
        type="text" value={props.value} onChange={(e) => props.onChange(e.target.value)}
        required={props.required}
        className="w-full rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none px-3.5 py-2.5 text-sm"
      />
    </label>
  );
}
