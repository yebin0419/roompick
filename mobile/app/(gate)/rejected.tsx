import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function Rejected() {
  const router = useRouter();
  const { profile } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <View
          style={{
            padding: 20,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.dangerText }}>
            학생증이 거절되었어요
          </Text>
          <Text style={{ marginTop: 8, color: colors.textMuted, lineHeight: 20 }}>
            아래 사유를 확인하고 다시 제출해 주세요.
          </Text>
          {profile?.rejected_reason && (
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                backgroundColor: colors.warningBg,
              }}
            >
              <Text style={{ color: colors.text }}>{profile.rejected_reason}</Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => router.replace("/verify")}
          style={{
            marginTop: 24,
            backgroundColor: colors.primary,
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "600" }}>
            학생증 다시 제출
          </Text>
        </Pressable>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={{ marginTop: 16, alignItems: "center" }}
        >
          <Text style={{ color: colors.textMuted }}>로그아웃</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
