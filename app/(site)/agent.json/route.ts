import { NextRequest } from "next/server";
import { buildAgentCard } from "@/lib/agent-card";
import { jsonResponse } from "@/lib/utils/public-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return jsonResponse(request, buildAgentCard(), { cacheSeconds: 60 });
}
