import Link from "next/link";
import AdminLoginForm from "./AdminLoginForm";

export const metadata = { title: "관리자 로그인 · 룸픽" };

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-slate-500 font-semibold mb-6">
          ← 룸픽
        </Link>
        <AdminLoginForm />
        <p className="mt-8 text-center text-sm text-slate-500">
          학생이신가요?{" "}
          <Link href="/login" className="text-slate-700 underline underline-offset-4">
            학생 로그인/가입
          </Link>
        </p>
      </div>
    </main>
  );
}
