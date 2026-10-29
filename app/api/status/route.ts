import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    aiPlannerReady: Boolean(process.env.GROQ_API_KEY),
    livePlaceAndRouteDataReady: Boolean(process.env.GEOAPIFY_API_KEY),
    databaseReady: Boolean(process.env.DATABASE_URL),
    model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    mapBase: "OpenStreetMap raster tiles",
  });
}
