import { NextResponse } from "next/server";
import { buildDiscoveryAuditPayload } from "@/lib/services/discovery-audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildDiscoveryAuditPayload();
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=120",
    },
  });
}
