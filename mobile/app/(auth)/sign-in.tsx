import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

export default function SignIn() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(
    params.error === "staff" ? "운영진·행정실 계정은 웹 관리자에서 사용하세요." : null,
  );

  const submit = async () => {
    if (!email || !password) {
      setErrorText("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setErrorText(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErrorText("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.replace("/");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>
              룸픽
            </Text>
            <Text style={{ marginTop: 6, color: colors.textMuted }}>
              경영대 학생 전용. 로그인 후 학생증 승인을 거쳐 사용합니다.
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            <Field
              label="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            <Field
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          {errorText && (
            <View
              style={{
                marginTop: 16,
                backgroundColor: colors.dangerBg,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.dangerText }}>{errorText}</Text>
            </View>
          )}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={{
              marginTop: 24,
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={{ color: colors.primaryText, fontWeight: "600" }}>로그인</Text>
            )}
          </Pressable>

          <View style={{ marginTop: 24, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted }}>
              아직 계정이 없나요?{" "}
              <Link href="/sign-up" style={{ color: colors.text, fontWeight: "600" }}>
                회원가입
              </Link>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };
function Field({ label, ...rest }: FieldProps) {
  return (
    <View>
      <Text style={{ fontSize: 13, color: colors.text, marginBottom: 6, fontWeight: "500" }}>
        {label}
      </Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textFaint}
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.text,
        }}
      />
    </View>
  );
}
