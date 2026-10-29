export type TravelStyle =
  | "Budget backpacker"
  | "Comfort"
  | "Luxury"
  | "Adventure"
  | "Slow & relaxed"
  | "Culture & colour"
  | "Food trail"
  | "Spiritual"
  | "Nature"
  | "Photography"
  | "Nightlife"
  | "Family";

export type PlaceCategory =
  | "Must See"
  | "Hidden Gem"
  | "Local Experience"
  | "Food Stop"
  | "Nature Escape"
  | "Cultural Experience"
  | "Photo Spot"
  | "Relaxation"
  | "Adventure";

export type BudgetCategory =
  | "Accommodation"
  | "Intercity transport"
  | "Food"
  | "Activities"
  | "Local transport"
  | "Miscellaneous";

export interface User {
  id: string;
  name?: string;
  email?: string;
  preferences?: UserPreference;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  state: string;
  description: string;
  bestSeason: string;
  seasonalNotes: string;
  dailySpend?: { min: number; max: number };
  typicalTransport: string[];
  dishes: string[];
  etiquette: string;
  cautions: string[];
  coordinates?: Coordinates;
  imageUrl?: string;
  imagePageUrl?: string;
  imageCredit?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  destinationId: string;
  name: string;
  neighborhood: string;
  category: PlaceCategory;
  description: string;
  coordinates: Coordinates;
  durationMin: number;
  costMin: number;
  costMax: number;
  openingHours: string;
  bestTime: string;
  etiquette?: string;
  interests: string[];
  source?: "Geoapify / OpenStreetMap" | "Curated example";
  sourceUrl?: string;
  priceKnown?: boolean;
  feeKnown?: boolean;
  fee?: boolean;
}

export interface TransportationOption {
  id: string;
  mode: string;
  label: string;
  typicalSpeedKmh?: number;
  costMin: number;
  costMax: number;
  notes: string;
  priceKnown?: boolean;
}

export interface Activity {
  id: string;
  place: Place;
  title: string;
  description: string;
  timeOfDay: "Morning" | "Afternoon" | "Evening" | "Night";
  durationMin: number;
  costMin: number;
  costMax: number;
  recommendedReason: string;
  alternatives: string[];
  category: PlaceCategory;
  transportation: TransportationOption[];
}

export interface ItineraryItem {
  id: string;
  activity: Activity;
  sortOrder: number;
  timeOfDay: Activity["timeOfDay"];
  durationMin: number;
  cost: number;
  distanceFromPreviousKm: number | null;
  travelMinutes: number | null;
  transportation: TransportationOption[];
  userNote?: string;
}

export interface ItineraryDay {
  id: string;
  tripId: string;
  dayNumber: number;
  title: string;
  neighborhood: string;
  routeKm: number;
  routeCoordinates?: [number, number][];
  routeMode?: string;
  routeStatus?: "routed" | "unavailable" | "not-requested";
  items: ItineraryItem[];
}

export interface TripDNA {
  adventure: number;
  culture: number;
  relaxation: number;
  food: number;
  nature: number;
  nightlife: number;
}

export interface BudgetLine {
  category: BudgetCategory;
  amount: number;
  notes: string;
}

export interface Budget {
  currency: "INR";
  estimatedTotal: number;
  perPerson: number;
  dailyAverage: number;
  dailyTargetPerPerson: number;
  lines: BudgetLine[];
  notes?: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  originCity: string;
  travelStyle: TravelStyle;
  interests: string[];
  preferredTransport: string;
  foodPreference: string;
  accommodation: string;
  budgetPerDay: number;
  travelers: number;
}

export interface Trip {
  id: string;
  userId: string;
  destination: Destination;
  originCity: string;
  startsOn?: string;
  travelers: number;
  preferences: UserPreference;
  dna: TripDNA;
  days: ItineraryDay[];
  budget: Budget;
  notices: string[];
  dataSources?: string[];
  candidatePlaces?: Place[];
}

export interface GenerateTripInput {
  userId: string;
  destination: string;
  originCity: string;
  startsOn?: string;
  dayCount: number;
  travelers: number;
  travelStyle: TravelStyle;
  interests: string[];
  preferredTransport: string;
  foodPreference: string;
  accommodation: string;
  budgetPerDay: number;
}

export type TripAdjustment =
  | "optimize-route"
  | "reduce-cost"
  | "set-budget"
  | "relaxed"
  | "nature"
  | "local-food"
  | "parents"
  | "remove-nightlife"
  | "add-day"
  | "duplicate-day"
  | "experience"
  | "regenerate-day";

export type ItineraryItemAction = "remove" | "replace" | "move" | "duration" | "reorder";
