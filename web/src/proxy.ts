import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_PATH = "/admin";
const STUDENT_PATH = "/student";
const LOGIN_PATH = "/login";

export async function proxy(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAdminArea = pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
  const isStudentArea =
    pathname === STUDENT_PATH || pathname.startsWith(`${STUDENT_PATH}/`);
  const isLoginArea = pathname === LOGIN_PATH;

  // 1) 보호 라우트에 미인증 접근 → /login (next 보존)
  if ((isAdminArea || isStudentArea) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 2) 세션 있으면 역할 조회 후 영역별 가드
  if (user && (isAdminArea || isStudentArea || isLoginArea)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile?.role;

    // 2a) /admin 은 OPERATOR/ADMIN 만
    if (isAdminArea && role !== "OPERATOR" && role !== "ADMIN") {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }

    // 2b) /student 는 STUDENT 만
    if (isStudentArea && role !== "STUDENT") {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }

    // 2c) 이미 로그인한 사용자가 /login 접근 → 역할별 홈
    if (isLoginArea) {
      const url = request.nextUrl.clone();
      if (role === "ADMIN" || role === "OPERATOR") url.pathname = ADMIN_PATH;
      else if (role === "STUDENT") url.pathname = STUDENT_PATH;
      else return response; // 역할 아직 없음 — 그대로 폼 노출
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // _next 정적 자산과 이미지, favicon을 제외한 모든 경로
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
