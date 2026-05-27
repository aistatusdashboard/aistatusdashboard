import { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/utils/public-api";
import { loadPublicStats } from "@/lib/services/public-stats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await loadPublicStats();
  return jsonResponse(request, payload, { cacheSeconds: 60 });
}
