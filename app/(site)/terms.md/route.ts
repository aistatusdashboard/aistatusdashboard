import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BODY = `# Terms of Service

By using AI Status Dashboard, you agree to these terms.

AI Status Dashboard provides public status, incident, and telemetry summaries for AI providers. Information is provided "as is" for reference only and may be delayed or incomplete.

You are responsible for verifying any critical decisions. We do not guarantee uptime, accuracy, or availability of the service.

You may not abuse or overload the public APIs. Automated access must respect published rate limits and robots.txt policies.

We may update these terms over time. Continued use of the service constitutes acceptance of the latest terms.

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
