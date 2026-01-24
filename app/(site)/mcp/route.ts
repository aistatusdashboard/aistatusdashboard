import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRequest, handleMcpStream } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function GET(request: NextRequest) {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/event-stream')) {
    return handleMcpStream(request);
  }
  const message = [
    'AIStatusDashboard MCP endpoint.',
    'Use POST with JSON-RPC 2.0 for tools, resources, and prompts.',
    'See https://aistatusdashboard.com/ai for quickstart and docs.',
  ].join('\n');

  if (accept.includes('application/json')) {
    return NextResponse.json(
      {
        message,
        mcp_endpoint: 'https://aistatusdashboard.com/mcp',
        quickstart: 'https://aistatusdashboard.com/docs/agent/mcp-quickstart',
        tools: 'https://aistatusdashboard.com/docs/agent/mcp-tools',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=600',
        },
      }
    );
  }

  return new NextResponse(message, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
