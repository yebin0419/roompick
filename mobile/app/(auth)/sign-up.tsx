import { Link, useRouter } from "expo-router";
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

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password || !name || !studentNumber) {
      setErrorText("모든 항목을 입력해 주세요.");
      return;
    }
    if (password.length < 8) {
      setErrorText("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setBusy(true);
    setErrorText(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, student_number: studentNumber } },
    });
    setBusy(false);
    if (error) {
      setErrorText(error.message);
      return;
    }
    // 트리거가 profiles 를 PENDING + role=STUDENT 로 생성. index.tsx가 verify로 라우팅.
    router.replace("/");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>회원가입</Text>
          <Text style={{ marginTop: 6, color: colors.textMuted }}>
            가입 후 학생증 사진을 1회 제출하면 운영진 승인을 받습니다.
          </Text>

          <View style={{ gap: 12, marginTop: 24 }}>
            <Field label="이름" value={name} onChangeText={setName} autoComplete="name" />
            <Field
              label="학번"
              value={studentNumber}
              onChangeText={setStudentNumber}
              keyboardType="number-pad"
            />
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
              label="비밀번호 (8자 이상)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
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
              <Text style={{ color: colors.primaryText, fontWeight: "600" }}>
                가입하고 학생증 제출로 이동
              </Text>
            )}
          </Pressable>

          <View style={{ marginTop: 24, alignItems: "center" }}>
            <Link href="/sign-in" style={{ color: colors.textMuted }}>
              이미 계정이 있어요
            </Link>
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
