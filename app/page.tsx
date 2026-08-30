// Vercel production deployment trigger: 2026-08-30
export default function Home() {
  return (
    <main className="dashboard-shell">
      <iframe
        className="dashboard-frame"
        src="/dashboard/report.html"
        title="쿠팡 성과 대시보드 정적 디자인 미리보기"
      />
    </main>
  );
}
