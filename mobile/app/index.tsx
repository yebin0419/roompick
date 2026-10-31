import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/providers/auth";

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;

  // 운영진·행정실은 웹 전용 — 모바일 앱으로 들어오면 로그아웃시키고 안내
  if (profile && profile.role !== "STUDENT") {
    return <Redirect href="/sign-in?error=staff" />;
  }

  // 학생증 제출 전이거나 프로필 트리거 지연
  if (!profile || !profile.student_id_card_url) {
    return <Redirect href="/verify" />;
  }

  if (profile.approval_status === "PENDING") return <Redirect href="/pending" />;
  if (profile.approval_status === "REJECTED") return <Redirect href="/rejected" />;

  return <Redirect href="/(tabs)" />;
}
