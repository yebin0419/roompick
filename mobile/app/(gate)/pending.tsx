import { Pressable, SafeAreaView, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";
import { colors } from "@/theme";

export default function Pending() {
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
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
            학생증 승인 대기 중
          </Text>
          <Text style={{ marginTop: 8, color: colors.textMuted, lineHeight: 20 }}>
            제출한 학생증을 운영진이 확인하고 있어요. 승인되면 자동으로 다음 화면으로
            이동합니다.
          </Text>

          <View style={{ marginTop: 16, gap: 2 }}>
            {profile?.name && (
              <Text style={{ color: colors.textFaint }}>이름: {profile.name}</Text>
            )}
            {profile?.student_number && (
              <Text style={{ color: colors.textFaint }}>학번: {profile.student_number}</Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={{ marginTop: 24, alignItems: "center" }}
        >
          <Text style={{ color: colors.textMuted }}>다른 계정으로 로그인</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
