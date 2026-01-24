export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# AIStatusDashboard GPT Actions

Use the public OpenAPI spec to add AIStatusDashboard as a GPT Action.

## Steps
1. Open the GPT editor and go to Actions.
2. Choose Import from URL.
3. Paste: https://aistatusdashboard.com/openapi.json
4. Save and test these calls:
   - GET /status/summary
   - GET /incidents
   - GET /metrics
   - POST /recommendations/fallback_plan

## Notes
- Public endpoints are read-only and do not require auth.
- Every response includes request_id, generated_at, evidence, and confidence.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
