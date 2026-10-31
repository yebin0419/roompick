import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(
            ({ name, value, options }: { name: string; value: string; options?: CookieOptions }) =>
              response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isAdminArea = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isStudentArea = pathname.startsWith("/student");
  const isAuthPage = pathname === "/login" || pathname === "/admin/login";

  if (!user) {
    if (isAdminArea) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    if (isStudentArea) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as "STUDENT" | "OPERATOR" | "ADMIN" | undefined;
  const approval = profile?.approval_status as "PENDING" | "APPROVED" | "REJECTED" | undefined;

  if (isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = role === "ADMIN" || role === "OPERATOR" ? "/admin" : "/student";
    return NextResponse.redirect(url);
  }

  if (isAdminArea && role !== "ADMIN" && role !== "OPERATOR") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (isStudentArea) {
    if (role !== "STUDENT") {
      const url = request.nextUrl.clone();
      url.pathname = role === "ADMIN" || role === "OPERATOR" ? "/admin" : "/login";
      return NextResponse.redirect(url);
    }
    if (approval !== "APPROVED" && !pathname.startsWith("/student/verify")) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/verify";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
