import { redirect } from "next/navigation";

export default function RootPage() {
  // 관리자 웹은 /admin 또는 /login만 사용. 루트 접근은 /admin으로 포워드하고
  // middleware에서 세션 상태에 따라 /login으로 떨어뜨린다.
  redirect("/admin");
}
