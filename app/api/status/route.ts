import { NextResponse } from "next/server";
import { groqModel } from "@/lib/live-planner";

export function GET() {
  return NextResponse.json({
    aiPlannerReady: Boolean(process.env.GROQ_API_KEY),
    livePlaceAndRouteDataReady: Boolean(process.env.GEOAPIFY_API_KEY),
    databaseReady: Boolean(process.env.DATABASE_URL),
    model: groqModel,
    mapBase: "OpenStreetMap raster tiles",
  });
}
