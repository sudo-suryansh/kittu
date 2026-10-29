import { randomUUID } from "node:crypto";
import { destinationBySlug, destinations, places, placesForDestination, transportOptions } from "@/lib/destination-data";
import type { Activity, Budget, BudgetCategory, Destination, GenerateTripInput, ItineraryDay, ItineraryItem, Place, Trip, TripAdjustment, TripDNA, TransportationOption } from "@/lib/types";

const DAY_PLANS: Record<string, { title: string; neighborhood: string; placeIds: string[] }[]> = {
  delhi: [
    { title: "The central Delhi loop", neighborhood: "India Gate · Janpath · Connaught Place", placeIds: ["india-gate", "national-museum", "connaught-place", "bangla-sahib", "dinner-cp"] },
    { title: "Tombs & green space", neighborhood: "Nizamuddin · Lodhi Road", placeIds: ["humayun-tomb", "old-delhi-food", "lodhi-garden"] },
    { title: "Old Delhi, slowly", neighborhood: "Chandni Chowk · Old Delhi", placeIds: ["old-delhi-food", "connaught-place"] },
  ],
  jaipur: [
    { title: "Arrival & the old city", neighborhood: "Pink City · short walkable hops", placeIds: ["city-palace", "jantar-mantar", "hawa-mahal"] },
    { title: "Amber & the hills", neighborhood: "Amber · one outward trip", placeIds: ["amber-fort", "city-palace"] },
    { title: "Craft, cafés & a soft goodbye", neighborhood: "Bapu Bazaar · central", placeIds: ["bapu-bazaar", "hawa-mahal"] },
  ],
  goa: [
    { title: "Arrive & settle in", neighborhood: "Panjim · Fontainhas", placeIds: ["fontainhas", "mandovi"] },
    { title: "Old Goa & a slow afternoon", neighborhood: "Old Goa · dedicated half-day", placeIds: ["old-goa-churches", "fontainhas"] },
    { title: "A beach day, your way", neighborhood: "Choose one coast", placeIds: ["goa-beach", "mandovi"] },
  ],
  varanasi: [
    { title: "Arrive & find the river", neighborhood: "Assi Ghat · south ghats", placeIds: ["assi-ghat", "dashashwamedh"] },
    { title: "River morning & old lanes", neighborhood: "Old City · ghats", placeIds: ["dashashwamedh", "assi-ghat"] },
    { title: "Sarnath & a gentle farewell", neighborhood: "Sarnath · separate half-day", placeIds: ["sarnath", "assi-ghat"] },
  ],
  kochi: [
    { title: "Arrive & Fort Kochi", neighborhood: "Fort Kochi · walkable", placeIds: ["fort-kochi", "fishing-nets"] },
    { title: "Island hop & local flavours", neighborhood: "Mattancherry · ferry or cab", placeIds: ["mattancherry", "fort-kochi"] },
    { title: "Art, coffee & onward", neighborhood: "Fort Kochi · flexible finish", placeIds: ["fort-kochi", "fishing-nets"] },
  ],
};

const spendShares: [BudgetCategory, number, string][] = [
  ["Accommodation", 0.34, "Stay choice varies by neighbourhood and dates."],
  ["Intercity transport", 0.18, "Compare train, bus and flight total journey time."],
  ["Food", 0.18, "A mix of regional meals and sit-down breaks."],
  ["Activities", 0.1, "Entry fees and guided experiences."],
  ["Local transport", 0.12, "Metro, bus, ferry, auto or short cab hops."],
  ["Miscellaneous", 0.08, "Water, small purchases and a contingency buffer."],
];

const interestKeys: Record<string, string[]> = {
  Architecture: ["architecture", "palace", "fort", "tomb", "church", "museum"],
  History: ["history", "palace", "fort", "tomb", "heritage", "museum"],
  Markets: ["market", "bazaar", "shop", "arcade"],
  Nature: ["nature", "garden", "beach", "river", "lake", "green"],
  "Local food": ["food", "meal", "lunch", "dinner", "chai", "local"],
  "Art & craft": ["craft", "art", "gallery", "workshop"],
  Temples: ["temple", "gurdwara", "church", "spiritual", "worship"],
  Nightlife: ["nightlife", "club", "bar", "party"],
};

const customPlace = (destination: Destination, id: string, name: string, category: Place["category"], description: string, interests: string[], latitude = 28.63, longitude = 77.21): Place => ({
  id,
  destinationId: destination.id,
  name,
  neighborhood: "Near your route",
  category,
  description,
  coordinates: { latitude, longitude },
  durationMin: 60,
  costMin: 0,
  costMax: 250,
  openingHours: "Check locally before you go",
  bestTime: "Morning or late afternoon",
  interests,
});

function fallbackDestination(name: string): Destination {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "india-trip";
  return {
    id: `destination-${slug}`,
    slug,
    name: name.trim() || "India",
    state: "India",
    description: `A flexible first plan for ${name.trim() || "your destination"}, ready to adapt with local advice.`,
    bestSeason: "Check local weather for your dates",
    seasonalNotes: "Heat, monsoon and festival dates can shift travel times and opening hours. Check current local updates.",
    dailySpend: { min: 1500, max: 6500 },
    typicalTransport: ["Walk", "Bus", "Auto-rickshaw", "App cab"],
    dishes: ["Ask locally for a regional speciality"],
    etiquette: "Follow posted guidance at religious and cultural sites, and ask before photographing people.",
    cautions: ["Confirm small-ride fares before departure.", "Use trusted transport after dark.", "Leave time for changing local conditions."],
  };
}

function resolveDestination(name: string): Destination {
  const alias = name.toLowerCase().trim();
  return destinationBySlug(alias) ?? destinations.find((item) => item.name.toLowerCase() === alias) ?? fallbackDestination(name);
}

function computeDNA(style: string, interests: string[]): TripDNA {
  const dna: TripDNA = { adventure: 38, culture: 42, relaxation: 40, food: 38, nature: 34, nightlife: 28 };
  const s = style.toLowerCase();
  if (s.includes("adventure")) { dna.adventure += 34; dna.nature += 12; }
  if (s.includes("culture") || s.includes("spiritual")) dna.culture += 30;
  if (s.includes("relaxed") || s.includes("comfort")) dna.relaxation += 34;
  if (s.includes("luxury")) { dna.relaxation += 22; dna.food += 12; }
  if (s.includes("food")) dna.food += 35;
  if (s.includes("nature")) dna.nature += 35;
  if (s.includes("nightlife")) dna.nightlife += 36;
  if (s.includes("family")) dna.relaxation += 18;
  for (const interest of interests) {
    if (["Architecture", "History", "Temples", "Art & craft"].includes(interest)) dna.culture += 17;
    if (interest === "Local food" || interest === "Markets") dna.food += 18;
    if (interest === "Nature") dna.nature += 20;
    if (interest === "Nightlife") dna.nightlife += 22;
  }
  for (const key of Object.keys(dna) as (keyof TripDNA)[]) dna[key] = Math.max(18, Math.min(97, dna[key]));
  return dna;
}

function scorePlace(place: Place, interests: string[], dna: TripDNA): number {
  const words = `${place.name} ${place.description} ${place.category} ${place.interests.join(" ")}`.toLowerCase();
  let score = place.category === "Must See" ? 3 : 0;
  for (const interest of interests) {
    const keywords = interestKeys[interest] ?? [interest.toLowerCase()];
    if (keywords.some((keyword) => words.includes(keyword))) score += 8;
  }
  if (place.category === "Nature Escape") score += dna.nature / 20;
  if (place.category === "Food Stop") score += dna.food / 20;
  if (place.category === "Cultural Experience") score += dna.culture / 20;
  return score;
}

function chooseTransport(preference: string, destination: Destination): TransportationOption[] {
  const requested = preference.toLowerCase();
  if (requested.includes("metro")) return [transportOptions[1], transportOptions[2]];
  if (requested.includes("cab") || requested.includes("drive")) return [transportOptions[4], transportOptions[2]];
  if (requested.includes("bus")) return [transportOptions[3], transportOptions[2]];
  if (requested.includes("train") || requested.includes("flight")) return [transportOptions[1], transportOptions[2]];
  const preferred = destination.typicalTransport.some((mode) => mode.toLowerCase().includes("metro")) ? [transportOptions[1], transportOptions[2], transportOptions[0]] : [transportOptions[2], transportOptions[3], transportOptions[0]];
  return preferred;
}

export function haversineKm(a: Place["coordinates"], b: Place["coordinates"]): number {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude), lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function buildActivity(place: Place, preference: GenerateTripInput, index: number, previous?: Place): ItineraryItem {
  const matches = preference.interests.filter((interest) => (interestKeys[interest] ?? [interest.toLowerCase()]).some((word) => `${place.name} ${place.description} ${place.interests.join(" ")}`.toLowerCase().includes(word.toLowerCase())));
  const styleReason = preference.travelStyle === "Family" ? "A comfortable pace with a clear rest point." : preference.travelStyle === "Budget backpacker" ? "Good value, with an affordable way to arrive." : `A fit for your ${preference.travelStyle.toLowerCase()} travel style.`;
  const interestReason = matches.length ? `Selected for your interest in ${matches.slice(0, 2).join(" and ").toLowerCase()}.` : "It sits close to today’s other stops.";
  const timeOfDay: Activity["timeOfDay"] = index === 0 ? "Morning" : index === 1 ? "Afternoon" : index === 2 ? "Evening" : "Night";
  const activity: Activity = {
    id: `activity-${place.id}-${randomUUID().slice(0, 8)}`,
    place,
    title: place.name,
    description: `${place.description} ${place.openingHours}.`,
    timeOfDay,
    durationMin: place.durationMin,
    costMin: preference.budgetPerDay < 1800 ? Math.min(place.costMin, 50) : place.costMin,
    costMax: preference.budgetPerDay < 1800 ? Math.min(place.costMax, 250) : place.costMax,
    recommendedReason: `${interestReason} ${styleReason}`,
    alternatives: ["A nearby café break", "A free neighbourhood walk"],
    category: place.category,
    transportation: chooseTransport(preference.preferredTransport, resolveDestination(preference.destination)),
  };
  const distance = previous ? haversineKm(previous.coordinates, place.coordinates) : 0;
  const mode = activity.transportation[0];
  const travelMinutes = distance === 0 ? 0 : Math.max(5, Math.round(distance / (mode.typicalSpeedKmh || 14) * 60 / 5) * 5);
  return {
    id: `item-${randomUUID()}`,
    activity,
    sortOrder: index,
    timeOfDay,
    durationMin: place.durationMin,
    cost: Math.round((activity.costMin + activity.costMax) / 2),
    distanceFromPreviousKm: Math.round(distance * 10) / 10,
    travelMinutes,
    transportation: activity.transportation,
  };
}

function routeDistance(items: ItineraryItem[]): number {
  return Math.round(items.reduce((total, item) => total + (item.distanceFromPreviousKm ?? 0), 0) * 10) / 10;
}

function makeDay(destination: Destination, preference: GenerateTripInput, tripId: string, dayNumber: number, planIndex: number): ItineraryDay {
  const allPlaces = placesForDestination(destination.id);
  const plans = DAY_PLANS[destination.slug] ?? [];
  const plan = plans[planIndex % Math.max(1, plans.length)];
  let selected: Place[];
  let title: string;
  let neighborhood: string;
  if (plan) {
    selected = plan.placeIds.map((id) => allPlaces.find((place) => place.id === id)).filter((item): item is Place => Boolean(item));
    title = plan.title;
    neighborhood = plan.neighborhood;
  } else {
    const ranked = [...allPlaces].sort((a, b) => scorePlace(b, preference.interests, computeDNA(preference.travelStyle, preference.interests)) - scorePlace(a, preference.interests, computeDNA(preference.travelStyle, preference.interests)));
    selected = ranked.slice((planIndex * 3) % Math.max(1, ranked.length), (planIndex * 3) % Math.max(1, ranked.length) + 3);
    title = dayNumber === 1 ? "Arrive & find your rhythm" : dayNumber === preference.dayCount ? "A slower finish" : "Explore one neighbourhood";
    neighborhood = selected[0]?.neighborhood ?? "A compact local area";
  }
  if (!selected.length) {
    const fallback = customPlace(destination, `local-walk-${dayNumber}`, `${destination.name} neighbourhood walk`, "Local Experience", "A flexible local walk. Ask your host for a nearby route and check conditions on the day.", preference.interests);
    selected = [fallback];
  }
  // Geography is the primary order signal; time-of-day remains a gentle tie-breaker.
  if (!plan) selected.sort((a, b) => scorePlace(b, preference.interests, computeDNA(preference.travelStyle, preference.interests)) - scorePlace(a, preference.interests, computeDNA(preference.travelStyle, preference.interests)));
  const itemActivities = selected.map((place, index) => buildActivity(place, preference, index, selected[index - 1]));
  const items = itemActivities.map((item, index) => ({ ...item, id: `${tripId}-day-${dayNumber}-item-${index + 1}`, sortOrder: index + 1 }));
  return { id: `${tripId}-day-${dayNumber}`, tripId, dayNumber, title, neighborhood, routeKm: routeDistance(items), items };
}

function createBudget(input: Pick<GenerateTripInput, "budgetPerDay" | "travelers" | "accommodation">, destination: Destination, dayCount: number): Budget {
  const daily = Math.max(800, input.budgetPerDay);
  const perPerson = daily * dayCount;
  const total = perPerson * input.travelers;
  const lines = spendShares.map(([category, share, notes]) => ({ category, amount: Math.round(total * share), notes }));
  if (input.accommodation.toLowerCase().includes("hostel")) lines[0].notes = "Hostel or homestay selected; neighbourhood and dates still affect rates.";
  if (destination.dailySpend && daily < destination.dailySpend.min) lines[0].notes = "To stay near this target, prioritize a hostel/homestay and public transport.";
  return { currency: "INR", estimatedTotal: total, perPerson, dailyAverage: daily, dailyTargetPerPerson: daily, lines };
}

export function generateTrip(input: GenerateTripInput): Trip {
  const destination = resolveDestination(input.destination);
  const tripId = `trip-${randomUUID()}`;
  const preferences = {
    id: `preference-${input.userId}`,
    userId: input.userId,
    originCity: input.originCity,
    travelStyle: input.travelStyle,
    interests: input.interests,
    preferredTransport: input.preferredTransport,
    foodPreference: input.foodPreference,
    accommodation: input.accommodation,
    budgetPerDay: input.budgetPerDay,
    travelers: input.travelers,
  };
  const days = Array.from({ length: Math.min(14, Math.max(1, input.dayCount)) }, (_, index) => makeDay(destination, input, tripId, index + 1, index));
  const notices = [
    `Best season: ${destination.bestSeason}. ${destination.seasonalNotes}`,
    `Typical local transport: ${destination.typicalTransport.join(", ")}. Check current service and operating hours.`,
    `Try: ${destination.dishes.join(", ")}. Ask about ingredients to match your food preference.`,
    destination.etiquette,
    ...destination.cautions,
    ...(destination.slug === "delhi" ? ["Train/flight transfer times can be disrupted by winter fog; check operator updates on travel day."] : []),
  ];
  return { id: tripId, userId: input.userId, destination, originCity: input.originCity, startsOn: input.startsOn, travelers: input.travelers, preferences, dna: computeDNA(input.travelStyle, input.interests), days, budget: createBudget(input, destination, days.length), notices };
}

function tripGenerationInput(trip: Trip, dayCount = trip.days.length): GenerateTripInput {
  return {
    userId: trip.userId,
    destination: trip.destination.name,
    originCity: trip.originCity,
    startsOn: trip.startsOn,
    dayCount,
    travelers: trip.travelers,
    travelStyle: trip.preferences.travelStyle,
    interests: trip.preferences.interests,
    preferredTransport: trip.preferences.preferredTransport,
    foodPreference: trip.preferences.foodPreference,
    accommodation: trip.preferences.accommodation,
    budgetPerDay: trip.preferences.budgetPerDay,
  };
}

export function optimizeItineraryDay(trip: Trip, dayIndex: number): Trip {
  const copy = structuredClone(trip);
  const day = copy.days[dayIndex];
  if (!day || day.items.length < 3) return copy;
  const first = day.items[0];
  const remaining = day.items.slice(1);
  const ordered = [first];
  while (remaining.length) {
    const current = ordered[ordered.length - 1].activity.place.coordinates;
    remaining.sort((a, b) => haversineKm(current, a.activity.place.coordinates) - haversineKm(current, b.activity.place.coordinates));
    ordered.push(remaining.shift()!);
  }
  day.items = ordered.map((item, index) => {
    const distance = index ? haversineKm(ordered[index - 1].activity.place.coordinates, item.activity.place.coordinates) : 0;
    const speed = item.transportation[0]?.typicalSpeedKmh || 14;
    return { ...item, sortOrder: index + 1, distanceFromPreviousKm: Math.round(distance * 10) / 10, travelMinutes: distance ? Math.max(5, Math.round(distance / speed * 12) * 5) : 0 };
  });
  day.routeKm = routeDistance(day.items);
  return copy;
}

function refreshBudget(trip: Trip, dailyTarget?: number): void {
  const input = { ...trip.preferences, budgetPerDay: dailyTarget ?? trip.budget.dailyTargetPerPerson };
  trip.budget = createBudget(input, trip.destination, trip.days.length);
  trip.preferences.budgetPerDay = input.budgetPerDay;
  trip.days.forEach((day) => day.items.forEach((item) => {
    item.activity.costMin = item.activity.place.costMin;
    item.activity.costMax = item.activity.place.costMax;
    if (input.budgetPerDay < 1800) {
      item.transportation = [transportOptions[1], transportOptions[3], transportOptions[2]];
    } else item.transportation = chooseTransport(trip.preferences.preferredTransport, trip.destination);
    item.activity.transportation = item.transportation;
  }));
}

export function adjustTrip(tripInput: Trip, adjustment: TripAdjustment, dayIndex = 0, dailyTarget?: number, experience?: Place): Trip {
  let trip = structuredClone(tripInput);
  const targetDay = trip.days[dayIndex] ?? trip.days[0];
  if (adjustment === "optimize-route") return optimizeItineraryDay(trip, dayIndex);
  if (adjustment === "set-budget") refreshBudget(trip, dailyTarget);
  if (adjustment === "reduce-cost") {
    refreshBudget(trip, dailyTarget ?? Math.round(trip.budget.dailyTargetPerPerson * 0.8));
    trip.days.forEach((day) => day.items.forEach((item) => {
      if (item.activity.costMax > 250) {
        item.activity.title = `${item.activity.title} · lower-cost option`;
        item.activity.costMin = Math.min(item.activity.costMin, 0);
        item.activity.costMax = Math.min(item.activity.costMax, 250);
        item.activity.recommendedReason = "Adjusted to fit the lower daily budget; consider the nearby free walk or local café alternative.";
        item.cost = Math.round((item.activity.costMin + item.activity.costMax) / 2);
      }
      item.transportation = [transportOptions[0], transportOptions[1], transportOptions[3]];
    }));
  }
  if (adjustment === "relaxed" && targetDay) {
    targetDay.items = targetDay.items.filter((_, index) => index === 0 || index === targetDay.items.length - 1);
    targetDay.title = `${targetDay.title} · slower pace`;
    targetDay.neighborhood += " · fewer stops, longer pauses";
    targetDay.items.forEach((item, index) => { item.sortOrder = index + 1; item.durationMin = Math.round(item.durationMin * 1.2); });
  }
  if (adjustment === "nature" && targetDay) {
    const nature = placesForDestination(trip.destination.id).find((place) => place.category === "Nature Escape") ?? customPlace(trip.destination, `nature-${randomUUID().slice(0, 7)}`, "A nearby green pause", "Nature Escape", "Take a shaded walk and check local weather before heading out.", ["Nature", "Relaxation"]);
    targetDay.items.push(buildActivity(nature, tripGenerationInput(trip), targetDay.items.length, targetDay.items.at(-1)?.activity.place));
  }
  if (adjustment === "local-food" && targetDay) {
    const foodPlace = placesForDestination(trip.destination.id).find((place) => place.category === "Food Stop") ?? customPlace(trip.destination, `food-${randomUUID().slice(0, 7)}`, `${trip.destination.name} local food stop`, "Food Stop", `Try a local dish such as ${trip.destination.dishes[0]}. Confirm ingredients with the vendor.`, ["Local food"]);
    targetDay.items.push(buildActivity(foodPlace, tripGenerationInput(trip), targetDay.items.length, targetDay.items.at(-1)?.activity.place));
  }
  if (adjustment === "parents" && targetDay) {
    targetDay.items = targetDay.items.filter((item, index) => index === 0 || index === targetDay.items.length - 1);
    targetDay.title = `${targetDay.title} · comfortable pace`;
    targetDay.items.forEach((item, index) => { item.durationMin = Math.max(item.durationMin, 75); item.activity.recommendedReason = "Selected for a comfortable pace. Add a seated rest and check step-free access before you go."; item.sortOrder = index + 1; });
  }
  if (adjustment === "remove-nightlife") {
    trip.days.forEach((day) => { day.items = day.items.filter((item) => !/nightlife|club|bar|party/i.test(`${item.activity.title} ${item.activity.description}`)); day.items.forEach((item, index) => { item.sortOrder = index + 1; }); });
  }
  if (adjustment === "experience" && targetDay && experience) {
    targetDay.items.push(buildActivity(experience, tripGenerationInput(trip), targetDay.items.length, targetDay.items.at(-1)?.activity.place));
  }
  if (adjustment === "regenerate-day" && targetDay) {
    const other = makeDay(trip.destination, tripGenerationInput(trip), trip.id, dayIndex + 1, dayIndex + 1);
    other.id = targetDay.id;
    trip.days[dayIndex] = other;
  }
  if (adjustment === "add-day") {
    const nextIndex = trip.days.length;
    trip.days.push(makeDay(trip.destination, tripGenerationInput(trip, nextIndex + 1), trip.id, nextIndex + 1, nextIndex));
  }
  if (adjustment === "duplicate-day" && targetDay) {
    const nextIndex = trip.days.length;
    trip.days.splice(nextIndex, 0, { ...structuredClone(targetDay), id: `${trip.id}-day-${nextIndex + 1}`, dayNumber: nextIndex + 1, title: `${targetDay.title} · another day`, items: targetDay.items.map((item, index) => ({ ...item, id: `${trip.id}-day-${nextIndex + 1}-item-${index + 1}`, activity: { ...item.activity, id: `activity-${randomUUID()}` }, sortOrder: index + 1 })) });
  }
  trip.days.forEach((day) => {
    day.items = day.items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    day.routeKm = routeDistance(day.items);
  });
  trip.budget = createBudget({ ...trip.preferences, budgetPerDay: trip.budget.dailyTargetPerPerson }, trip.destination, trip.days.length);
  return trip;
}

export function updateItineraryItem(tripInput: Trip, itemId: string, action: "remove" | "replace" | "move" | "duration" | "reorder", value?: string | number, dayIndex = 0): Trip {
  const trip = structuredClone(tripInput);
  const sourceDay = trip.days[dayIndex];
  if (!sourceDay) return trip;
  const sourceIndex = sourceDay.items.findIndex((item) => item.id === itemId);
  if (sourceIndex < 0) return trip;
  const [item] = sourceDay.items.splice(sourceIndex, 1);
  if (action === "remove") {
    // The item is intentionally omitted from the updated day.
  } else if (action === "duration") {
    item.durationMin = Number(value) || item.durationMin;
    item.activity.durationMin = item.durationMin;
    sourceDay.items.splice(sourceIndex, 0, item);
  } else if (action === "replace") {
    item.activity.title = item.activity.alternatives[0] ?? "Nearby neighbourhood pause";
    item.activity.description = "A nearby alternative selected for your plan. Check local timing and conditions before you go.";
    item.activity.costMin = 0;
    item.activity.costMax = 200;
    item.activity.recommendedReason = "A lower-cost nearby alternative that keeps this day’s route intact.";
    item.cost = 100;
    sourceDay.items.splice(sourceIndex, 0, item);
  } else if (action === "move") {
    const targetIndex = Math.max(0, Math.min(trip.days.length - 1, Number(value)));
    trip.days[targetIndex].items.push(item);
  } else if (action === "reorder") {
    let targetIndex = typeof value === "number" ? sourceIndex + value : sourceDay.items.findIndex((candidate) => candidate.id === value);
    if (targetIndex < 0) targetIndex = sourceDay.items.length;
    targetIndex = Math.max(0, Math.min(sourceDay.items.length, targetIndex));
    sourceDay.items.splice(targetIndex, 0, item);
  }
  for (const day of trip.days) {
    day.items = day.items.map((current, index) => {
      const previous = day.items[index - 1];
      const distance = previous ? haversineKm(previous.activity.place.coordinates, current.activity.place.coordinates) : 0;
      const speed = current.transportation[0]?.typicalSpeedKmh || 14;
      return { ...current, sortOrder: index + 1, distanceFromPreviousKm: Math.round(distance * 10) / 10, travelMinutes: distance ? Math.max(5, Math.round(distance / speed * 12) * 5) : 0 };
    });
    day.routeKm = routeDistance(day.items);
  }
  trip.budget = createBudget({ ...trip.preferences, budgetPerDay: trip.budget.dailyTargetPerPerson }, trip.destination, trip.days.length);
  return trip;
}

export const allDestinations = () => destinations;
export const allPlaces = () => places;
