import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "dashboard", "report.html");
  let html = await readFile(filePath, "utf8");

  // report.html is a captured Next.js render. Its old hydration runtime can crash
  // after deployment because it expects the original app/API contract. The page
  // already contains the fully rendered dashboard markup, so keep that markup and
  // our report/enhancement scripts while removing only the stale Next runtime.
  html = html
    .replace(/<script[^>]+src=["']\.\/assets\/chunks\/[^"']+["'][^>]*><\/script>/gi, "")
    .replace(/<script[^>]*>\s*\(self\.__next_f[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*>\s*self\.__next_f[\s\S]*?<\/script>/gi, "");

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
