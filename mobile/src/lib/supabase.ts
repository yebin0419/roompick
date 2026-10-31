import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // 번들에 env가 들어가지 않은 경우를 대비한 안전장치. 개발자 콘솔에서만 보인다.
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 비어 있습니다. mobile/.env 를 설정하세요.",
  );
}

export const supabase = createClient<Database>(url ?? "", anonKey ?? "", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const BUCKET_STUDENT_ID = "student-id-cards";
export const BUCKET_CHECK_IN = "check-in-photos";
export const BUCKET_REPORTS = "report-photos";
