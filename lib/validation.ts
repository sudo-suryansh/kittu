import { z } from "zod";

export const travelStyles = ["Budget backpacker", "Comfort", "Luxury", "Adventure", "Slow & relaxed", "Culture & colour", "Food trail", "Spiritual", "Nature", "Photography", "Nightlife", "Family"] as const;

export const generateTripSchema = z.object({
  userId: z.string().min(1).max(100),
  destination: z.string().min(2).max(90),
  originCity: z.string().min(2).max(90),
  startsOn: z.string().date().optional().or(z.literal("")),
  dayCount: z.number().int().min(1).max(14),
  travelers: z.number().int().min(1).max(20),
  travelStyle: z.enum(travelStyles),
  interests: z.array(z.string().min(1).max(40)).max(12),
  preferredTransport: z.string().min(1).max(80),
  foodPreference: z.string().min(1).max(80),
  accommodation: z.string().min(1).max(80),
  budgetPerDay: z.number().int().min(500).max(100000),
});

export const adjustmentSchema = z.object({
  trip: z.unknown(),
  adjustment: z.enum(["optimize-route", "reduce-cost", "set-budget", "relaxed", "nature", "local-food", "parents", "remove-nightlife", "add-day", "duplicate-day", "experience", "regenerate-day"]),
  dayIndex: z.number().int().min(0).max(13).default(0),
  dailyTarget: z.number().int().min(500).max(100000).optional(),
  experience: z.unknown().optional(),
});

export const itineraryItemActionSchema = z.object({
  trip: z.unknown(),
  itemId: z.string().min(1),
  action: z.enum(["remove", "replace", "move", "duration", "reorder"]),
  value: z.union([z.string(), z.number()]).optional(),
  dayIndex: z.number().int().min(0).max(13).default(0),
});
