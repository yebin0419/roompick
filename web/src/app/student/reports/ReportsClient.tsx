"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const CATEGORIES = [
  { key: "BROKEN_EQUIPMENT", label: "비품 고장" },
  { key: "CLEANLINESS", label: "청결" },
  { key: "NO_SHOW", label: "노쇼" },
  { key: "OTHER", label: "기타" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  OPEN: "접수", IN_PROGRESS: "처리중", RESOLVED: "완료", DISMISSED: "반려",
};

export default function ReportsClient({
  rooms, myReports,
}: {
  rooms: { id: string; code: string }[];
  myReports: { id: string; category: string; content: string; status: string;
    created_at: string; room: { code: string } | null }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [category, setCategory] = useState<string>("BROKEN_EQUIPMENT");
  const [roomId, setRoomId] = useState<string>("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      let photoUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("report-photos").upload(path, file, {
          contentType: file.type || "image/jpeg", upsert: true,
        });
        if (up.error) throw up.error;
        photoUrl = supabase.storage.from("report-photos").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        room_id: roomId || null,
        category, content, photo_url: photoUrl,
      });
      if (error) throw error;
      setContent(""); setFile(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">신고</h1>
        <p className="mt-1 text-sm text-slate-500">
          시설 고장·청결 문제·노쇼 등을 접수하면 운영진이 처리합니다.
        </p>
      </header>

      <form onSubmit={submit} className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              type="button" key={c.key} onClick={() => setCategory(c.key)}
              className={`text-xs rounded-full border px-3 py-1.5 ${
                category === c.key
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1.5">강의실</span>
          <select
            value={roomId} onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">(선택 안 함)</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.code}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1.5">내용</span>
          <textarea
            value={content} onChange={(e) => setContent(e.target.value)} required rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1.5">사진 (선택)</span>
          <input
            type="file" accept="image/*" capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-white"
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium py-3"
        >
          {loading ? "접수 중..." : "접수"}
        </button>
      </form>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 mb-2">최근 내가 접수한 신고</h2>
        <ul className="space-y-2">
          {myReports.map((r) => (
            <li key={r.id} className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">
                  {r.room?.code ?? "-"} · {CATEGORIES.find((c) => c.key === r.category)?.label ?? r.category}
                </p>
                <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{r.content}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(r.created_at).toLocaleString("ko-KR")}
              </p>
            </li>
          ))}
          {myReports.length === 0 && (
            <p className="text-sm text-slate-500">접수한 신고가 없어요.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
