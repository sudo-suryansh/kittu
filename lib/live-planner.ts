import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Budget, BudgetCategory, Coordinates, Destination, GenerateTripInput, ItineraryDay, ItineraryItem, Place, PlaceCategory, Trip, TripDNA, TransportationOption } from "@/lib/types";

const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const geoKey = () => process.env.GEOAPIFY_API_KEY;
const tripDNA = (style: string, interests: string[]): TripDNA => {
  const result: TripDNA = { adventure: 30, culture: 30, relaxation: 30, food: 30, nature: 30, nightlife: 20 };
  const value = style.toLowerCase();
  if (value.includes("adventure")) result.adventure += 40;
  if (value.includes("culture") || value.includes("spiritual")) result.culture += 40;
  if (value.includes("relax") || value.includes("comfort")) result.relaxation += 35;
  if (value.includes("food")) result.food += 40;
  if (value.includes("nature")) result.nature += 40;
  if (value.includes("nightlife")) result.nightlife += 45;
  if (value.includes("family")) result.relaxation += 20;
  for (const interest of interests) {
    if (["Architecture", "History", "Temples", "Art & craft"].includes(interest)) result.culture += 12;
    if (["Local food", "Markets"].includes(interest)) result.food += 12;
    if (interest === "Nature") result.nature += 12;
    if (interest === "Nightlife") result.nightlife += 12;
  }
  for (const key of Object.keys(result) as (keyof TripDNA)[]) result[key] = Math.min(97, result[key]);
  return result;
};

const schema = z.object({
  days: z.array(z.object({
    title: z.string().min(3).max(70),
    neighborhood: z.string().min(2).max(90),
    items: z.array(z.object({
      placeId: z.string().min(1),
      timeOfDay: z.enum(["Morning", "Afternoon", "Evening", "Night"]),
      durationMin: z.number().int().min(20).max(240),
      why: z.string().min(8).max(240),
    })),
  })),
});

const responseSchema = {
  type: "object",
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          neighborhood: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                placeId: { type: "string" },
                timeOfDay: { type: "string", enum: ["Morning", "Afternoon", "Evening", "Night"] },
                durationMin: { type: "integer" },
                why: { type: "string" },
              },
              required: ["placeId", "timeOfDay", "durationMin", "why"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "neighborhood", "items"],
        additionalProperties: false,
      },
    },
  },
  required: ["days"],
  additionalProperties: false,
} as const;

async function geoJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = geoKey();
  if (!key) throw new Error("GEOAPIFY_API_KEY is not configured. Add a free Geoapify key in .env.local to search real places and calculate routes.");
  const url = new URL(path);
  for (const [name, value] of Object.entries({ ...params, apiKey: key })) url.searchParams.set(name, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(18_000), cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let providerMessage = "";
    try {
      const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
      providerMessage = typeof parsed.message === "string" ? parsed.message : typeof parsed.error === "string" ? parsed.error : "";
    } catch { /* Ignore non-JSON provider error bodies. */ }
    providerMessage = providerMessage.replace(/apiKey=[^&\s]+/gi, "apiKey=[redacted]").slice(0, 220);
    const message = response.status === 401 || response.status === 403
      ? "Geoapify rejected the API key. Check that GEOAPIFY_API_KEY is valid and that Geocoding, Places, and Routing are enabled."
      : `Geoapify ${url.pathname} request failed (${response.status})${providerMessage ? `: ${providerMessage}` : ". Check the request parameters, key, quota, and provider status."}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

type GeocodeResult = { lat: number; lon: number; name?: string; city?: string; state?: string; country_code?: string; formatted?: string; result_type?: string };
type GeoFeature = { geometry?: { type?: string; coordinates?: [number, number] }; properties?: Record<string, unknown> };
type GeoPlacesResponse = { features?: GeoFeature[] };
type RouteLeg = { distance?: number; time?: number };
type RouteResponse = { features?: { geometry?: { type?: string; coordinates?: unknown }; properties?: { distance?: number; time?: number; legs?: RouteLeg[] } }[] };

function categoryFromTags(tags: string[]): PlaceCategory {
  if (tags.some((tag) => tag.startsWith("catering."))) return "Food Stop";
  if (tags.some((tag) => tag.startsWith("leisure.park") || tag.startsWith("natural."))) return "Nature Escape";
  if (tags.some((tag) => tag.startsWith("tourism.sights") || tag.startsWith("tourism.attraction"))) return "Must See";
  if (tags.some((tag) => tag.startsWith("entertainment.culture") || tag.startsWith("entertainment.museum"))) return "Cultural Experience";
  if (tags.some((tag) => tag.startsWith("commercial.marketplace") || tag.startsWith("commercial.shopping_mall"))) return "Local Experience";
  if (tags.some((tag) => tag.startsWith("tourism."))) return "Photo Spot";
  return "Local Experience";
}

function toPlace(feature: GeoFeature, destinationId: string): Place | undefined {
  const props = feature.properties ?? {};
  const point = feature.geometry?.coordinates;
  const longitude = point?.[0], latitude = point?.[1];
  const name = typeof props.name === "string" ? props.name.trim() : "";
  const id = typeof props.place_id === "string" ? props.place_id : "";
  if (!name || !id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  const tags = Array.isArray(props.categories) ? props.categories.filter((tag): tag is string => typeof tag === "string") : [];
  const address = typeof props.address_line2 === "string" ? props.address_line2 : typeof props.city === "string" ? props.city : "Map listing";
  const raw = props.datasource && typeof props.datasource === "object" ? (props.datasource as { raw?: Record<string, unknown> }).raw : undefined;
  const feeRaw = raw?.fee;
  const feeKnown = feeRaw === "yes" || feeRaw === "no" || feeRaw === true || feeRaw === false;
  const fee = feeRaw === "no" || feeRaw === false;
  const opening = typeof props.opening_hours === "string" && props.opening_hours.trim() ? props.opening_hours : "Hours not listed by the map provider";
  return {
    id,
    destinationId,
    name,
    neighborhood: address,
    category: categoryFromTags(tags),
    description: `${address}. Place listing sourced from OpenStreetMap data through Geoapify.`,
    coordinates: { latitude: Number(latitude), longitude: Number(longitude) },
    durationMin: 60,
    costMin: 0,
    costMax: 0,
    openingHours: opening,
    bestTime: "Timing suggestion only; check conditions and opening hours",
    interests: tags,
    source: "Geoapify / OpenStreetMap",
    sourceUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`,
    priceKnown: false,
    feeKnown,
    fee,
  };
}

async function getDestinationAndPlaces(name: string): Promise<{ destination: Destination; places: Place[] }> {
  const geocoded = await geoJson<{ results?: GeocodeResult[] }>("https://api.geoapify.com/v1/geocode/search", { text: `${name}, India`, filter: "countrycode:in", limit: "1", format: "json" });
  const result = geocoded.results?.[0];
  if (!result || result.country_code?.toLowerCase() !== "in") throw new Error(`We could not locate “${name}” in India. Try a city, town, or region name.`);
  const destinationId = `geo-${result.lon.toFixed(4)}-${result.lat.toFixed(4)}`;
  const destination: Destination = {
    id: destinationId,
    slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: result.city || result.name || name,
    state: result.state || "India",
    description: result.formatted || `${result.city || result.name || name}, ${result.state || "India"}`,
    bestSeason: "Not verified for your dates",
    seasonalNotes: "TravelSetu has not checked a live weather or festival calendar for these dates.",
    dailySpend: undefined,
    typicalTransport: [],
    dishes: [],
    etiquette: "Local etiquette has not been verified for this destination. Follow posted guidance and ask before photographing people.",
    cautions: [],
    coordinates: { latitude: result.lat, longitude: result.lon },
  };
  const params = {
    categories: "tourism.sights,tourism.attraction,entertainment.museum,tourism.attraction.artwork,leisure.park,entertainment.culture,catering.restaurant,catering.cafe,commercial.marketplace",
    filter: `circle:${result.lon},${result.lat},22000`,
    bias: `proximity:${result.lon},${result.lat}`,
    limit: "60",
    lang: "en",
  };
  const found = await geoJson<GeoPlacesResponse>("https://api.geoapify.com/v2/places", params);
  const placeList = (found.features ?? []).map((feature) => toPlace(feature, destinationId)).filter((place): place is Place => Boolean(place));
  if (!placeList.length) throw new Error(`Geoapify found no named attractions or experiences near ${destination.name}. Try a nearby city centre or a broader destination name.`);
  return { destination, places: placeList };
}

export async function searchDestinationPlaces(name: string) {
  return getDestinationAndPlaces(name);
}

export async function searchNearbyPlaces(query: string, center: Coordinates, destinationId: string) {
  const params = {
    categories: "tourism.sights,tourism.attraction,entertainment.museum,tourism.attraction.artwork,leisure.park,entertainment.culture,catering.restaurant,catering.cafe,commercial.marketplace",
    name: query,
    filter: `circle:${center.longitude},${center.latitude},30000`,
    bias: `proximity:${center.longitude},${center.latitude}`,
    limit: "8",
    lang: "en",
  };
  const result = await geoJson<GeoPlacesResponse>("https://api.geoapify.com/v2/places", params);
  return (result.features ?? []).map((feature) => toPlace(feature, destinationId)).filter((place): place is Place => Boolean(place));
}

async function generateWithGroq(input: GenerateTripInput, destination: Destination, placeList: Place[]) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured. Add a Groq key in .env.local to generate a real itinerary.");
  const candidateData = placeList.map((place) => ({ id: place.id, name: place.name, category: place.category, neighborhood: place.neighborhood, coordinates: place.coordinates, listedHours: place.openingHours, knownFree: place.feeKnown ? place.fee : null }));
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(55_000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_completion_tokens: 5000,
      response_format: { type: "json_schema", json_schema: { name: "travelsetu_itinerary", strict: true, schema: responseSchema } },
      messages: [
        { role: "system", content: "You plan practical trips in India. Use only the supplied map-provider places and IDs. Never create or rename a place. Build one compact, geographically coherent day at a time, with 2–4 distinct places per day when enough data exists. Do not repeat places across days. Match the requested food, interests, pace, budget, transport, and travel party. Use approximate time-of-day sequencing, but do not infer opening hours from time slots. The `why` field is a preference match, not a claim about current conditions. Do not invent costs, ticket prices, transit schedules, weather, safety, or cultural rules. Return exactly the requested number of days. If fewer than 2–4 suitable places are available, use only those that exist." },
        { role: "user", content: JSON.stringify({ task: "Select and sequence a day-by-day itinerary", trip: { destination: destination.name, state: destination.state, originCity: input.originCity, days: input.dayCount, travelers: input.travelers, budgetPerPersonPerDayINR: input.budgetPerDay, travelStyle: input.travelStyle, interests: input.interests, transportPreference: input.preferredTransport, foodPreference: input.foodPreference, accommodationPreference: input.accommodation }, availablePlaces: candidateData }) },
      ],
    }),
  });
  if (!response.ok) {
    const detail = response.status === 401 || response.status === 403
      ? "Groq rejected the API key. Check GROQ_API_KEY and account access."
      : response.status === 429
        ? "Groq rate limit reached. Wait a little and try again."
        : `Groq could not generate the itinerary (${response.status}). Try again or reduce the trip length.`;
    throw new Error(detail);
  }
  const completion = await response.json() as { choices?: { message?: { content?: string | null; refusal?: string } }[] };
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty itinerary. No plan was created.");
  let parsedJson: unknown;
  try { parsedJson = JSON.parse(content); } catch { throw new Error("Groq returned unreadable JSON. No plan was created; please try once more."); }
  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) throw new Error("Groq’s itinerary did not match TravelSetu’s required format. No plan was created.");
  if (parsed.data.days.length !== input.dayCount) throw new Error("Groq returned a different number of days than requested. No plan was created; please try once more.");
  const ids = new Set(placeList.map((place) => place.id));
  const used = new Set<string>();
  for (const day of parsed.data.days) {
    for (const item of day.items) {
      if (!ids.has(item.placeId)) throw new Error("Groq selected a place that was not returned by the live map data. No plan was created.");
      if (used.has(item.placeId)) throw new Error("Groq repeated a place in the itinerary. No plan was created; please try once more.");
      used.add(item.placeId);
    }
  }
  return parsed.data.days;
}

function budgetFor(input: GenerateTripInput, days: number): Budget {
  const shares: [BudgetCategory, number][] = [["Accommodation", .34], ["Intercity transport", .18], ["Food", .18], ["Activities", .1], ["Local transport", .12], ["Miscellaneous", .08]];
  const perPerson = input.budgetPerDay * days;
  const estimatedTotal = perPerson * input.travelers;
  return {
    currency: "INR",
    estimatedTotal,
    perPerson,
    dailyAverage: input.budgetPerDay,
    dailyTargetPerPerson: input.budgetPerDay,
    lines: shares.map(([category, share]) => ({ category, amount: Math.round(estimatedTotal * share), notes: "Allocation of your budget target; live prices are not fetched." })),
    notes: "This is a spending target split, not a quote. Accommodation, transport fares, meal prices and tickets are not verified by this app.",
  };
}

function roadMode(preference: string): string {
  const value = preference.toLowerCase();
  if (value.includes("walk")) return "walk";
  if (value.includes("bus")) return "bus";
  if (value.includes("metro") || value.includes("train")) return "transit";
  return "drive";
}

function routeCoordinates(geometry: RouteResponse["features"] extends (infer T)[] | undefined ? T extends { geometry?: infer G } ? G : never : never): [number, number][] {
  const coordinates = (geometry as { coordinates?: unknown } | undefined)?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  if (coordinates.length && Array.isArray(coordinates[0]) && typeof coordinates[0][0] === "number") return coordinates as [number, number][];
  return coordinates.flatMap((line) => Array.isArray(line) ? line as [number, number][] : []);
}

async function routeDay(items: ItineraryItem[], mode: string): Promise<{ coords: [number, number][]; legs: RouteLeg[] } | null> {
  if (items.length < 2) return null;
  const waypoints = items.map((item) => `${item.activity.place.coordinates.latitude},${item.activity.place.coordinates.longitude}`).join("|");
  const route = await geoJson<RouteResponse>("https://api.geoapify.com/v1/routing", { waypoints, mode, units: "metric", lang: "en" });
  const feature = route.features?.[0];
  if (!feature?.geometry) return null;
  return { coords: routeCoordinates(feature.geometry), legs: feature.properties?.legs ?? [] };
}

function makeItem(place: Place, tripId: string, dayNumber: number, sortOrder: number, why: string, timeOfDay: ItineraryItem["timeOfDay"] = "Afternoon", durationMin = 60): ItineraryItem {
  const mode = "drive";
  const transport: TransportationOption = { id: `route-${mode}`, mode, label: "Road route", costMin: 0, costMax: 0, priceKnown: false, notes: "Route profile only; no live traffic, fare, or timetable." };
  return { id: `${tripId}-day-${dayNumber}-item-${randomUUID()}`, activity: { id: `activity-${place.id}`, place, title: place.name, description: place.description, timeOfDay, durationMin, costMin: 0, costMax: 0, recommendedReason: why, alternatives: [], category: place.category, transportation: [transport] }, sortOrder, timeOfDay, durationMin, cost: 0, distanceFromPreviousKm: null, travelMinutes: null, transportation: [transport] };
}

async function refreshRoute(day: ItineraryDay) {
  day.items.forEach((item) => { item.distanceFromPreviousKm = null; item.travelMinutes = null; });
  day.routeCoordinates = undefined;
  day.routeKm = 0;
  if (day.items.length < 2) { day.routeStatus = "not-requested"; return; }
  try {
    const route = await routeDay(day.items, day.routeMode || "drive");
    if (!route?.coords.length) { day.routeStatus = "unavailable"; return; }
    day.routeStatus = "routed";
    day.routeCoordinates = route.coords;
    day.routeKm = route.legs.reduce((sum, leg) => sum + (leg.distance ?? 0), 0) / 1000;
    day.items.forEach((item, index) => {
      const leg = route.legs[index - 1];
      if (leg && Number.isFinite(leg.distance) && Number.isFinite(leg.time)) {
        item.distanceFromPreviousKm = Math.round((leg.distance! / 100)) / 10;
        item.travelMinutes = Math.max(1, Math.round(leg.time! / 60));
      }
    });
  } catch {
    day.routeStatus = "unavailable";
  }
}

function preferenceInput(trip: Trip, days: number): GenerateTripInput {
  return { userId: trip.userId, destination: trip.destination.name, originCity: trip.originCity, startsOn: trip.startsOn, dayCount: days, travelers: trip.travelers, travelStyle: trip.preferences.travelStyle, interests: trip.preferences.interests, preferredTransport: trip.preferences.preferredTransport, foodPreference: trip.preferences.foodPreference, accommodation: trip.preferences.accommodation, budgetPerDay: trip.preferences.budgetPerDay };
}

function rebudget(trip: Trip) {
  const total = trip.preferences.budgetPerDay * trip.days.length * trip.travelers;
  const shares = [.34, .18, .18, .1, .12, .08];
  trip.budget = { ...trip.budget, estimatedTotal: total, perPerson: trip.preferences.budgetPerDay * trip.days.length, dailyAverage: trip.preferences.budgetPerDay, dailyTargetPerPerson: trip.preferences.budgetPerDay, lines: trip.budget.lines.map((line, index) => ({ ...line, amount: Math.round(total * (shares[index] ?? 0)), notes: "Allocation of your budget target; live prices are not fetched." })) };
}

function haversine(a: Coordinates, b: Coordinates) {
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export async function adjustLiveTrip(source: Trip, adjustment: string, dayIndex: number, dailyTarget?: number, experience?: Place): Promise<Trip> {
  const trip = structuredClone(source);
  const day = trip.days[dayIndex];
  const candidates = trip.candidatePlaces ?? [];
  if (!day && !["add-day"].includes(adjustment)) throw new Error("Choose a day in this itinerary first.");
  if (adjustment === "set-budget") {
    if (!dailyTarget) throw new Error("Enter a daily budget target first.");
    trip.preferences.budgetPerDay = dailyTarget;
    rebudget(trip);
    return trip;
  }
  if (adjustment === "add-day") {
    if (trip.days.length >= 14) throw new Error("Trips can have up to 14 days.");
    const used = new Set(trip.days.flatMap((item) => item.items.map((entry) => entry.activity.place.id)));
    const remaining = candidates.filter((place) => !used.has(place.id));
    if (remaining.length < 2) throw new Error("Geoapify did not return enough unused places to build an additional day.");
    const draft = await generateWithGroq(preferenceInput(trip, 1), trip.destination, remaining);
    const dayNumber = trip.days.length + 1;
    const newDay: ItineraryDay = { id: `${trip.id}-day-${dayNumber}`, tripId: trip.id, dayNumber, title: draft[0].title, neighborhood: draft[0].neighborhood, routeKm: 0, routeMode: day?.routeMode || "drive", routeStatus: "unavailable", items: draft[0].items.map((entry, i) => makeItem(remaining.find((place) => place.id === entry.placeId)!, trip.id, dayNumber, i + 1, entry.why, entry.timeOfDay, entry.durationMin)) };
    await refreshRoute(newDay);
    trip.days.push(newDay); rebudget(trip); return trip;
  }
  if (adjustment === "duplicate-day") {
    if (!day) throw new Error("Choose a day to duplicate first.");
    if (trip.days.length >= 14) throw new Error("Trips can have up to 14 days.");
    const dayNumber = trip.days.length + 1;
    const duplicate: ItineraryDay = { ...structuredClone(day), id: `${trip.id}-day-${dayNumber}`, dayNumber, items: day.items.map((item, index) => ({ ...structuredClone(item), id: `${trip.id}-day-${dayNumber}-item-${index + 1}` })) };
    await refreshRoute(duplicate);
    trip.days.push(duplicate); rebudget(trip); return trip;
  }
  if (!day) throw new Error("Choose a day in this itinerary first.");
  if (adjustment === "regenerate-day") {
    const elsewhere = new Set(trip.days.filter((_, index) => index !== dayIndex).flatMap((item) => item.items.map((entry) => entry.activity.place.id)));
    const available = candidates.filter((place) => !elsewhere.has(place.id));
    const draft = await generateWithGroq(preferenceInput(trip, 1), trip.destination, available);
    day.title = draft[0].title; day.neighborhood = draft[0].neighborhood;
    day.items = draft[0].items.map((entry, i) => makeItem(available.find((place) => place.id === entry.placeId)!, trip.id, day.dayNumber, i + 1, entry.why, entry.timeOfDay, entry.durationMin));
  } else if (adjustment === "optimize-route") {
    const remaining = [...day.items];
    const ordered: ItineraryItem[] = [];
    let current = remaining.shift();
    if (current) ordered.push(current);
    while (remaining.length && ordered.length) {
      const previous = ordered[ordered.length - 1].activity.place.coordinates;
      remaining.sort((a, b) => haversine(previous, a.activity.place.coordinates) - haversine(previous, b.activity.place.coordinates));
      ordered.push(remaining.shift()!);
    }
    day.items = ordered;
  } else if (adjustment === "reduce-cost") {
    const free = candidates.filter((place) => place.feeKnown && place.fee === true);
    if (!free.length) throw new Error("The map data does not identify any confirmed free-entry alternatives here, so I cannot claim this day is cheaper.");
    const picks = free.filter((place) => !trip.days.some((item) => item.items.some((entry) => entry.activity.place.id === place.id)) || day.items.some((entry) => entry.activity.place.id === place.id));
    if (!picks.length) throw new Error("There are no unused places with a confirmed free-entry listing for this day.");
    const currentIds = new Set(day.items.map((item) => item.activity.place.id));
    const replacement = picks.find((place) => !currentIds.has(place.id));
    if (!replacement) throw new Error("This day already uses all confirmed free-entry places in the live map data.");
    const target = day.items.find((item) => !(item.activity.place.feeKnown && item.activity.place.fee === true)) ?? day.items.at(-1);
    if (target) day.items[day.items.indexOf(target)] = makeItem(replacement, trip.id, day.dayNumber, target.sortOrder, "Listed by the map provider as free entry; verify at the venue.", target.timeOfDay, target.durationMin);
  } else if (adjustment === "relaxed" || adjustment === "parents") {
    day.items = day.items.filter((_, index) => index === 0 || index === day.items.length - 1).map((item) => ({ ...item, durationMin: Math.min(240, item.durationMin + 30), activity: { ...item.activity, durationMin: Math.min(240, item.durationMin + 30), recommendedReason: adjustment === "parents" ? "Fewer stops and more time at each; confirm accessibility and rest facilities with the venue." : "Fewer stops and more time to pause between them." } }));
    if (adjustment === "parents") day.title = `${day.title} · gentler pace`;
  } else if (adjustment === "nature" || adjustment === "local-food") {
    const wanted = adjustment === "nature" ? "Nature Escape" : "Food Stop";
    const present = new Set(trip.days.flatMap((item) => item.items.map((entry) => entry.activity.place.id)));
    const options = candidates.filter((place) => place.category === wanted && !present.has(place.id));
    if (!options.length) throw new Error(`No unused ${wanted.toLowerCase()} listings were returned by the live map data for this destination.`);
    const base = day.items.at(-1)?.activity.place.coordinates ?? trip.destination.coordinates ?? options[0].coordinates;
    options.sort((a, b) => haversine(base, a.coordinates) - haversine(base, b.coordinates));
    day.items.push(makeItem(options[0], trip.id, day.dayNumber, day.items.length + 1, `Selected from nearby live map listings to add a ${adjustment === "nature" ? "nature" : "local food"} stop.`, adjustment === "local-food" ? "Evening" : "Afternoon"));
  } else if (adjustment === "remove-nightlife") {
    const next = day.items.filter((item) => !item.activity.place.interests.some((interest) => /nightlife|bar|pub/i.test(interest)));
    if (next.length === day.items.length) throw new Error("The live map listings do not mark any current stop as nightlife, so no activity was removed.");
    day.items = next;
  } else if (adjustment === "experience") {
    if (!experience?.id) throw new Error("Choose a live map listing to add.");
    let place = candidates.find((candidate) => candidate.id === experience.id);
    if (!place && experience.coordinates) place = (await searchNearbyPlaces(experience.name, experience.coordinates, trip.destination.id)).find((candidate) => candidate.id === experience.id);
    if (!place) throw new Error("That place is no longer in the live map results. Search again and choose a current listing.");
    day.items.push(makeItem(place, trip.id, day.dayNumber, day.items.length + 1, "Added from a live Geoapify and OpenStreetMap listing."));
  } else throw new Error("This trip adjustment is not supported.");
  day.items.forEach((item, index) => { item.sortOrder = index + 1; });
  await refreshRoute(day);
  return trip;
}

export async function updateLiveItem(source: Trip, itemId: string, action: string, value: string | number | undefined, dayIndex: number): Promise<Trip> {
  const trip = structuredClone(source);
  const foundDayIndex = trip.days.findIndex((day, index) => index === dayIndex && day.items.some((item) => item.id === itemId));
  if (foundDayIndex < 0) throw new Error("That activity is no longer on the selected day. Refresh the itinerary and try again.");
  const day = trip.days[foundDayIndex];
  const itemIndex = day.items.findIndex((item) => item.id === itemId);
  if (action === "remove") day.items.splice(itemIndex, 1);
  else if (action === "duration") {
    const duration = Number(value);
    if (!Number.isInteger(duration) || duration < 20 || duration > 240) throw new Error("Choose a duration between 20 minutes and 4 hours.");
    day.items[itemIndex].durationMin = duration; day.items[itemIndex].activity.durationMin = duration;
  } else if (action === "move") {
    const target = Number(value);
    if (!Number.isInteger(target) || target < 0 || target >= trip.days.length) throw new Error("Choose a valid day for this activity.");
    if (target !== foundDayIndex) { const [item] = day.items.splice(itemIndex, 1); trip.days[target].items.push(item); await refreshRoute(trip.days[target]); }
  } else if (action === "reorder") {
    const targetIndex = typeof value === "number" ? itemIndex + value : day.items.findIndex((item) => item.id === value);
    if (targetIndex < 0) throw new Error("Drop the activity on another stop in the same day.");
    if (targetIndex >= day.items.length) throw new Error("This activity is already at the end of the day.");
    const [item] = day.items.splice(itemIndex, 1); day.items.splice(targetIndex, 0, item);
  } else if (action === "replace") {
    const used = new Set(trip.days.flatMap((current) => current.items.map((item) => item.activity.place.id)));
    const current = day.items[itemIndex].activity.place;
    const options = (trip.candidatePlaces ?? []).filter((place) => !used.has(place.id) && place.category === current.category);
    options.sort((a, b) => haversine(current.coordinates, a.coordinates) - haversine(current.coordinates, b.coordinates));
    if (!options.length) throw new Error("No unused nearby listing in this activity category is available to replace this stop.");
    const old = day.items[itemIndex];
    day.items[itemIndex] = makeItem(options[0], trip.id, day.dayNumber, old.sortOrder, "Nearby live map listing in the same experience category; preference match not recalculated.", old.timeOfDay, old.durationMin);
  } else throw new Error("That activity edit is not supported.");
  day.items.forEach((item, index) => { item.sortOrder = index + 1; });
  await refreshRoute(day);
  return trip;
}

export async function createLiveTrip(input: GenerateTripInput): Promise<Trip> {
  if (!process.env.GEOAPIFY_API_KEY) throw new Error("Live destination search is not set up. Add GEOAPIFY_API_KEY to .env.local using a Geoapify free-tier key.");
  if (!process.env.GROQ_API_KEY) throw new Error("AI itinerary generation is not set up. Add GROQ_API_KEY to .env.local using a Groq API key.");
  const { destination, places } = await getDestinationAndPlaces(input.destination);
  const dayDrafts = await generateWithGroq(input, destination, places);
  const id = `trip-${randomUUID()}`;
  const placeById = new Map(places.map((place) => [place.id, place]));
  const mode = roadMode(input.preferredTransport);
  const days: ItineraryDay[] = dayDrafts.map((day, index) => {
    const items: ItineraryItem[] = day.items.map((draft, itemIndex) => {
      const place = placeById.get(draft.placeId)!;
      const transport: TransportationOption = { id: `route-${mode}`, mode, label: `${mode[0].toUpperCase()}${mode.slice(1)} route`, costMin: 0, costMax: 0, priceKnown: false, notes: "Map route profile only. It does not provide a transit timetable, traffic condition, fare, or ticket." };
      return {
        id: `${id}-day-${index + 1}-item-${itemIndex + 1}`,
        activity: { id: `activity-${place.id}`, place, title: place.name, description: place.description, timeOfDay: draft.timeOfDay, durationMin: draft.durationMin, costMin: 0, costMax: 0, recommendedReason: draft.why, alternatives: [], category: place.category, transportation: [transport] },
        sortOrder: itemIndex + 1,
        timeOfDay: draft.timeOfDay,
        durationMin: draft.durationMin,
        cost: 0,
        distanceFromPreviousKm: null,
        travelMinutes: null,
        transportation: [transport],
      };
    });
    return { id: `${id}-day-${index + 1}`, tripId: id, dayNumber: index + 1, title: day.title, neighborhood: day.neighborhood, routeKm: 0, routeMode: mode, routeStatus: "unavailable", items };
  });
  const routeWarnings: string[] = [];
  for (const day of days) {
    if (day.items.length < 2) { day.routeStatus = "not-requested"; continue; }
    try {
      const route = await routeDay(day.items, mode);
      if (!route?.coords.length) { routeWarnings.push(`No ${mode} route was returned for Day ${day.dayNumber}.`); continue; }
      day.routeCoordinates = route.coords;
      day.routeStatus = "routed";
      day.routeKm = route.legs.reduce((sum, leg) => sum + (leg.distance ?? 0), 0) / 1000;
      day.items.forEach((item, itemIndex) => {
        const leg = route.legs[itemIndex - 1];
        if (leg) {
          item.distanceFromPreviousKm = Math.round((leg.distance ?? 0) / 100) / 10;
          item.travelMinutes = Math.max(1, Math.round((leg.time ?? 0) / 60));
        }
      });
    } catch (error) {
      routeWarnings.push(error instanceof Error ? error.message : `Routing was unavailable for Day ${day.dayNumber}.`);
    }
  }
  const preferences = { id: `preference-${input.userId}`, userId: input.userId, originCity: input.originCity, travelStyle: input.travelStyle, interests: input.interests, preferredTransport: input.preferredTransport, foodPreference: input.foodPreference, accommodation: input.accommodation, budgetPerDay: input.budgetPerDay, travelers: input.travelers };
  const notices = [
    "Generated by Groq using places Geoapify returned for this destination. Activity picks are AI suggestions; verify opening hours and ticket rules with the venue.",
    "The map shows OpenStreetMap data. Route distance and duration come from Geoapify routing profiles; they are not live traffic or transit timetables.",
    "Budget figures split your chosen target. Live hotel rates, train/flight fares, restaurant prices, ticket prices, weather and festival calendars were not checked.",
    "Place names and map data are supplied by Geoapify and OpenStreetMap. Report map data issues to OpenStreetMap.",
    ...routeWarnings,
  ];
  return {
    id, userId: input.userId, destination, originCity: input.originCity, startsOn: input.startsOn, travelers: input.travelers,
    preferences, dna: tripDNA(input.travelStyle, input.interests), days, budget: budgetFor(input, days.length), notices,
    dataSources: ["Groq · itinerary selection and preference reasoning", "Geoapify Places and Routing · live place listings and route geometry", "OpenStreetMap contributors · map data"],
    candidatePlaces: places,
  };
}
