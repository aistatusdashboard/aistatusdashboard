import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BODY = `# Cookies and local storage

AI Status Dashboard uses essential browser storage for core product features such as accessibility settings and session continuity.

Optional analytics and telemetry storage is only enabled when you accept it in the cookie banner. If you reject optional storage, we do not send client-side analytics or telemetry events from your browser.

You can update your choice any time using the Cookie preferences link in the footer.

Contact: hello@aistatusdashboard.com
`;

export async function GET() {
  return new NextResponse(BODY, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}
