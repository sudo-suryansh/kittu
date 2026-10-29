import { NextResponse } from "next/server";
import { z } from "zod";
import { searchNearbyPlaces } from "@/lib/live-planner";

const inputSchema = z.object({
  query: z.string().trim().min(2).max(100),
  destinationId: z.string().min(1).max(160),
  coordinates: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }),
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Enter a place name to search near the selected destination." }, { status: 400 });
  try {
    const places = await searchNearbyPlaces(parsed.data.query, parsed.data.coordinates, parsed.data.destinationId);
    return NextResponse.json({ places });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geoapify place search failed.";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
