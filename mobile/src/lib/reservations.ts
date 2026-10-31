import type { ReservationStatus } from "./types";

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  AUTO_APPROVED: "자동 승인",
  PENDING_OPERATOR: "운영진 승인 대기",
  PENDING_ADMIN: "행정실 승인 대기",
  APPROVED: "승인 완료",
  REJECTED: "거절",
  CANCELLED: "취소됨",
};

export const STATUS_TONE: Record<
  ReservationStatus,
  "success" | "warning" | "danger" | "muted"
> = {
  AUTO_APPROVED: "success",
  APPROVED: "success",
  PENDING_OPERATOR: "warning",
  PENDING_ADMIN: "warning",
  REJECTED: "danger",
  CANCELLED: "muted",
};

export function isCancellable(status: ReservationStatus): boolean {
  return (
    status === "AUTO_APPROVED" ||
    status === "APPROVED" ||
    status === "PENDING_OPERATOR" ||
    status === "PENDING_ADMIN"
  );
}
