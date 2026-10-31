import type { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { navigateFromNotification } from "@/lib/notification-routing";
import { registerForPushNotificationsAsync } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 1) 세션 로드/구독
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // 2) 세션 바뀔 때 프로필 조회
  const userId = session?.user?.id;
  const loadProfile = useCallback(async (id: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile(data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProfile(userId);
  }, [userId, loadProfile]);

  // 3) Realtime: 운영진이 승인/거절 시 즉시 반영
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => setProfile(payload.new as Profile),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    await loadProfile(userId);
  }, [userId, loadProfile]);

  // 4) 로그인 상태에서 Expo Push Token 등록
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      await supabase.from("push_tokens").upsert({
        user_id: userId,
        token,
        platform: Platform.OS,
        last_seen_at: new Date().toISOString(),
      });
    })();
  }, [userId]);

  // 5) 푸시 알림 탭 → 딥링크. 세션 로드 완료 후 1회 콜드 스타트 처리 + 런타임 리스너.
  const coldStartHandled = useRef(false);
  useEffect(() => {
    if (loading || coldStartHandled.current) return;
    coldStartHandled.current = true;
    (async () => {
      const resp = await Notifications.getLastNotificationResponseAsync();
      if (resp) {
        navigateFromNotification(resp.notification.request.content.data);
      }
    })();
  }, [loading]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      navigateFromNotification(resp.notification.request.content.data);
    });
    return () => sub.remove();
  }, []);

  const value = useMemo(
    () => ({ session, profile, loading, refreshProfile }),
    [session, profile, loading, refreshProfile],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
