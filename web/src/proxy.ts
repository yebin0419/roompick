import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_PATH = "/admin";
const LOGIN_PATH = "/login";

export async function proxy(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAdminArea = pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
  const isLoginArea = pathname === LOGIN_PATH;

  // 1) /admin 미인증 → /login
  if (isAdminArea && !user) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 2) /admin 접근은 OPERATOR/ADMIN 만 허용
  if (isAdminArea && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || (profile.role !== "OPERATOR" && profile.role !== "ADMIN")) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }
  }

  // 3) 이미 로그인한 운영진/행정실이 /login 접근 → /admin
  if (isLoginArea && user) {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_PATH;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // _next 정적 자산과 이미지, favicon을 제외한 모든 경로
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
