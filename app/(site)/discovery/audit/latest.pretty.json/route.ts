import { NextResponse } from "next/server";
import { buildDiscoveryAuditPayload } from "@/lib/services/discovery-audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildDiscoveryAuditPayload();
  return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=120",
    },
  });
}
