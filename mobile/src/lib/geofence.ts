// 캠퍼스 Geofence — SQL `public.is_within_campus` 와 동일한 상수 유지.
// 운영팀이 실측치로 조정할 때는 양쪽을 같이 바꿔야 한다.

export const CAMPUS = {
  centerLat: 36.6274,
  centerLng: 127.4559,
  radiusMeters: 150,
} as const;

export function isWithinCampus(lat: number, lng: number): boolean {
  const degLat = CAMPUS.radiusMeters / 111_000;
  const degLng = CAMPUS.radiusMeters / 88_000;
  return (
    Math.abs(lat - CAMPUS.centerLat) <= degLat &&
    Math.abs(lng - CAMPUS.centerLng) <= degLng
  );
}
