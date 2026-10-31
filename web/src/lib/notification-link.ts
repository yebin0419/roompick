// 웹 관리자용: notifications.data payload → admin 경로 매핑
// 운영진용 트리거(0014)의 data 모양과 1:1 대응.

export function linkFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  const studentId = typeof d.student_id === "string" ? d.student_id : null;
  if (studentId) return `/admin/students/${studentId}`;

  const reservationId = typeof d.reservation_id === "string" ? d.reservation_id : null;
  if (reservationId) return `/admin/reservations/${reservationId}`;

  const reportId = typeof d.report_id === "string" ? d.report_id : null;
  if (reportId) return `/admin/reports/${reportId}`;

  return null;
}
