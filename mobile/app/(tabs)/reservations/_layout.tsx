import { Stack } from "expo-router";

export default function ReservationsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "예약 상세" }} />
    </Stack>
  );
}
