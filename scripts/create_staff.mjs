// 운영진/행정실 계정 사전 발급 스크립트 (PRD §2.2 ② ③).
//
// 사용법:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/create_staff.mjs <email> <password> <role> [name]
//
// role: OPERATOR | ADMIN
//
// 예:
//   node scripts/create_staff.mjs ops@example.com 'Tmp!1234' OPERATOR '김운영'
//   node scripts/create_staff.mjs admin@example.com 'Tmp!1234' ADMIN '최행정'

import { createClient } from "@supabase/supabase-js";

const [, , email, password, role, name] = process.argv;
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!email || !password || !role) {
  console.error("usage: node scripts/create_staff.mjs <email> <password> <role> [name]");
  process.exit(1);
}
if (role !== "OPERATOR" && role !== "ADMIN") {
  console.error(`role must be OPERATOR or ADMIN (got ${role})`);
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("env SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name: name ?? null },
});
if (error || !data.user) {
  console.error("createUser failed:", error?.message ?? "no user returned");
  process.exit(1);
}

// profiles 는 schema 상 role 기본값이 STUDENT 이므로 즉시 upsert
const { error: upsertError } = await admin
  .from("profiles")
  .upsert({
    id: data.user.id,
    role,
    approval_status: "APPROVED",
    name: name ?? null,
  });

if (upsertError) {
  console.error("profiles upsert failed:", upsertError.message);
  // 트랜잭션 없음 — 유저는 생성됐지만 role이 STUDENT로 남을 수 있음. 수동 수정 필요.
  process.exit(1);
}

console.log(`✓ ${role} created: ${email} (id=${data.user.id})`);
