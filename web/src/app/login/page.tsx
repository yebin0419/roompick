import { Suspense } from "react";

import LoginForm from "./LoginForm";

// useSearchParams 를 쓰는 자식이 Suspense 로 감싸져 있어야 build 시 prerender 통과
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Suspense
        fallback={<div className="text-sm text-zinc-400">로딩 중...</div>}
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
