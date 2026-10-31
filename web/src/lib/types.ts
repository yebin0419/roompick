export type Role = "STUDENT" | "OPERATOR" | "ADMIN";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReservationStatus =
  | "RESERVED"
  | "CHECKED_IN"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export type ReportCategory =
  | "NO_SHOW"
  | "BROKEN_EQUIPMENT"
  | "CLEANLINESS"
  | "OTHER";

export type ReportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  student_id: string | null;
  role: Role;
  approval_status: ApprovalStatus;
  student_card_url: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  code: string;
  building: string;
  building_name: string | null;
  floor: string | null;
  capacity: number | null;
  features: string[] | null;
  room_type: string | null;
  is_available: boolean;
}

export interface Reservation {
  id: string;
  user_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  status: ReservationStatus;
  created_at: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  professor: string | null;
  section: string | null;
  room_code: string | null;
  weekday: number | null;
  start_period: number | null;
  end_period: number | null;
  raw_time: string | null;
}

export interface Report {
  id: string;
  reporter_id: string;
  room_id: string | null;
  reservation_id: string | null;
  category: ReportCategory;
  content: string;
  photo_url: string | null;
  status: ReportStatus;
  created_at: string;
}
