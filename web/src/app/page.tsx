import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-2xl w-full text-center">
          <p className="text-brand-500 font-semibold tracking-wide text-sm">
            RoomPick · 룸픽
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold text-slate-900">
            비어 있는 강의실을 <br className="hidden sm:block" />
            실시간으로 Pick.
          </h1>
          <p className="mt-5 text-slate-600 leading-relaxed">
            경영대 학생과 교직원이 수업·행사가 없는 강의실을 조회하고
            팀플·스터디·행사용으로 간편하게 예약·공유하는 공간 플랫폼입니다.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Link
              href="/login"
              className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium py-3.5 shadow-sm transition"
            >
              학생으로 시작하기
            </Link>
            <Link
              href="/admin/login"
              className="rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 font-medium py-3.5 shadow-sm transition"
            >
              관리자 로그인
            </Link>
          </div>

          <ul className="mt-14 grid gap-4 text-left sm:grid-cols-3">
            {[
              ["실시간 빈 강의실", "시간표 역산으로 지금 당장 비어 있는 강의실만 노출"],
              ["간편한 예약", "학생 1분 자동 승인 · 행사는 운영진 승인"],
              ["GPS 체크인", "강의실 반경 안에서 사진 첨부로 입실 처리"],
            ].map(([title, desc]) => (
              <li key={title} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100">
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-500">{desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <footer className="py-6 text-center text-xs text-slate-400">
        충북대학교 경영대학 · 룸픽
      </footer>
    </main>
  );
}
