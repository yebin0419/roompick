// Expo Push 의 data payload 로부터 앱 내 경로를 결정한다.
//
// 알림 유형별 data 형태 (0009/0010/0013 트리거 참조):
//   reservation_decided : { reservation_id, status }
//   ending_soon         : { reservation_id }
//   no_show             : { reservation_id }
//   slot_available      : { room_code, date, start_period, end_period }

import { router } from "expo-router";

type AnyData = Record<string, unknown> | null | undefined;

type Target =
  | { kind: "reserve"; room: string; date: string; period: string }
  | { kind: "reservation-detail"; id: string }
  | null;

export function targetFromData(data: AnyData): Target {
  if (!data || typeof data !== "object") return null;

  const roomCode = typeof data.room_code === "string" ? data.room_code : null;
  const date = typeof data.date === "string" ? data.date : null;
  const startPeriod = typeof data.start_period === "string" ? data.start_period : null;
  if (roomCode && date && startPeriod) {
    return { kind: "reserve", room: roomCode, date, period: startPeriod };
  }

  const reservationId = typeof data.reservation_id === "string" ? data.reservation_id : null;
  if (reservationId) {
    return { kind: "reservation-detail", id: reservationId };
  }

  return null;
}

export function navigateFromNotification(data: AnyData): boolean {
  const target = targetFromData(data);
  if (!target) return false;
  if (target.kind === "reserve") {
    router.push({
      pathname: "/reserve",
      params: { room: target.room, date: target.date, period: target.period },
    });
  } else {
    router.push(`/(tabs)/reservations/${target.id}`);
  }
  return true;
}
