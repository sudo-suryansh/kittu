import { NextResponse } from "next/server";
import { createLiveTrip } from "@/lib/live-planner";
import { saveTrip } from "@/lib/repositories/trip-repository";
import { generateTripSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = generateTripSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Check the trip details and try again.", details: parsed.error.flatten() }, { status: 400 });

  let trip;
  try {
    trip = await createLiveTrip(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The live planner could not build this trip.";
    const status = message.includes("not configured") || message.includes("not set up") ? 503 : message.includes("could not locate") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
  let persisted = false;
  if (process.env.DATABASE_URL) {
    try {
      await saveTrip(trip);
      persisted = true;
    } catch (error) {
      console.error("TravelSetu trip persistence failed", error);
    }
  }
  return NextResponse.json({ trip, persisted }, { status: 201 });
}
