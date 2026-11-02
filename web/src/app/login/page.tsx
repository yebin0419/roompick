import Image from "next/image";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata = { title: "로그인 · 룸픽" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="flex flex-col items-center text-brand-500 font-semibold mb-6"
          aria-label="룸픽 홈으로"
        >
          <Image
            src="/logo.png"
            alt="룸픽 로고"
            width={64}
            height={64}
            priority
            className="w-16 h-16 rounded-xl shadow-sm"
          />
          <span className="mt-2">룸픽</span>
        </Link>
        <LoginForm />
        <p className="mt-8 text-center text-sm text-slate-500">
          관리자이신가요?{" "}
          <Link href="/admin/login" className="text-slate-700 underline underline-offset-4">
            관리자 로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
