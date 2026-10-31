import { signIn } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "이메일과 비밀번호를 입력해 주세요.",
  invalid: "이메일 또는 비밀번호가 올바르지 않습니다.",
  forbidden: "관리자 권한이 없는 계정입니다. 운영팀에 문의해 주세요.",
};

type SP = { error?: string; next?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const errorKey = typeof sp.error === "string" ? sp.error : undefined;
  const next = typeof sp.next === "string" ? sp.next : "/admin";
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] ?? "로그인에 실패했습니다." : null;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">룸픽 관리자</h1>
          <p className="text-sm text-zinc-500">
            운영진·행정실 전용. 사전 발급된 계정으로 로그인하세요.
          </p>
        </header>

        <form action={signIn} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          {errorMessage && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            로그인
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500">
          학생은 모바일 앱에서 회원가입 후 학생증을 제출하세요.
        </p>
      </div>
    </div>
  );
}
