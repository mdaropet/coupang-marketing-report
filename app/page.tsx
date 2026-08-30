export default function Home() {
  return (
    <main className="dashboard-shell">
      <iframe
        className="dashboard-frame"
        src="/dashboard/static-report"
        title="쿠팡 성과 대시보드"
      />
    </main>
  );
}
