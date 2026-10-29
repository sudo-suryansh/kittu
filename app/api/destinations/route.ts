import { NextResponse } from "next/server";
import { destinations } from "@/lib/destination-data";
import { searchDestinationPlaces } from "@/lib/live-planner";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("destination");
  if (!slug) return NextResponse.json({ destinations, places: [] });
  const destination = destinations.find((item) => item.slug === slug);
  if (!destination) return NextResponse.json({ error: "Choose a destination from the list." }, { status: 400 });
  try {
    const result = await searchDestinationPlaces(destination.name);
    return NextResponse.json({ destinations, destination: result.destination, places: result.places });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live places could not be loaded.";
    const status = message.includes("not configured") || message.includes("not set up") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
