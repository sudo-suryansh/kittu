import { NextResponse } from "next/server";
import { adjustLiveTrip } from "@/lib/live-planner";
import { saveTrip } from "@/lib/repositories/trip-repository";
import { adjustmentSchema } from "@/lib/validation";
import type { Place, Trip, TripAdjustment } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = adjustmentSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.trip || typeof parsed.data.trip !== "object") {
    return NextResponse.json({ error: "A current itinerary and a valid adjustment are required." }, { status: 400 });
  }
  const trip = parsed.data.trip as Trip;
  if (trip.id !== tripId || !Array.isArray(trip.days) || !trip.budget) {
    return NextResponse.json({ error: "The itinerary does not match this trip." }, { status: 400 });
  }
  const experience = parsed.data.experience as Place | undefined;
  try {
    const updated = await adjustLiveTrip(trip, parsed.data.adjustment as TripAdjustment, parsed.data.dayIndex, parsed.data.dailyTarget, experience);
    if (process.env.DATABASE_URL) {
      try { await saveTrip(updated); } catch (error) { console.error("TravelSetu trip update persistence failed", error); }
    }
    return NextResponse.json({ trip: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "This change could not be applied.";
    return NextResponse.json({ error: message }, { status: /Groq|Geoapify|route|map data|live map/i.test(message) ? 502 : 422 });
  }
}
