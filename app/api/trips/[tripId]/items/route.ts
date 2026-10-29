import { NextResponse } from "next/server";
import { saveTrip } from "@/lib/repositories/trip-repository";
import { updateLiveItem } from "@/lib/live-planner";
import { itineraryItemActionSchema } from "@/lib/validation";
import type { Trip } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = itineraryItemActionSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.trip || typeof parsed.data.trip !== "object") return NextResponse.json({ error: "A current itinerary and an activity action are required." }, { status: 400 });
  const trip = parsed.data.trip as Trip;
  if (trip.id !== tripId || !Array.isArray(trip.days)) return NextResponse.json({ error: "The itinerary does not match this trip." }, { status: 400 });
  try {
    const updated = await updateLiveItem(trip, parsed.data.itemId, parsed.data.action, parsed.data.value, parsed.data.dayIndex);
    if (process.env.DATABASE_URL) {
      try { await saveTrip(updated); } catch (error) { console.error("TravelSetu item edit persistence failed", error); }
    }
    return NextResponse.json({ trip: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "That activity could not be updated.";
    return NextResponse.json({ error: message }, { status: /Geoapify|route|map data/i.test(message) ? 502 : 422 });
  }
}
