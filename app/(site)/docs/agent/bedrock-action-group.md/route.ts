export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# AIStatusDashboard Bedrock Action Group

Use the OpenAPI 3.0 spec for Bedrock Agents.

## Steps
1. In Bedrock Agents, create an Action Group.
2. Import from URL:
   - https://aistatusdashboard.com/openapi-3.0.json
3. Set the base URL to https://aistatusdashboard.com/api/public/v1
4. Test example calls:
   - GET /status/summary
   - GET /incidents
   - GET /metrics

## Notes
- OpenAPI 3.0 is provided for compatibility.
- Responses include request_id, generated_at, evidence, and confidence.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
