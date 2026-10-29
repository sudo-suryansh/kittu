import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Trip } from "@/lib/types";

export async function saveTrip(trip: Trip): Promise<void> {
  const serialized = JSON.parse(JSON.stringify(trip)) as Prisma.InputJsonValue;
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({ where: { id: trip.userId }, create: { id: trip.userId }, update: {} });
    await tx.userPreference.upsert({
      where: { userId: trip.userId },
      create: {
        userId: trip.userId,
        originCity: trip.preferences.originCity,
        travelStyle: trip.preferences.travelStyle,
        interests: trip.preferences.interests,
        preferredTransport: [trip.preferences.preferredTransport],
        foodPreferences: [trip.preferences.foodPreference],
        accommodation: trip.preferences.accommodation,
        budgetPerDayPaise: trip.preferences.budgetPerDay * 100,
        defaultTravelers: trip.preferences.travelers,
      },
      update: {
        originCity: trip.preferences.originCity,
        travelStyle: trip.preferences.travelStyle,
        interests: trip.preferences.interests,
        preferredTransport: [trip.preferences.preferredTransport],
        foodPreferences: [trip.preferences.foodPreference],
        accommodation: trip.preferences.accommodation,
        budgetPerDayPaise: trip.preferences.budgetPerDay * 100,
        defaultTravelers: trip.preferences.travelers,
      },
    });

    await tx.destination.upsert({
      where: { slug: trip.destination.slug },
      create: {
        id: trip.destination.id,
        slug: trip.destination.slug,
        name: trip.destination.name,
        state: trip.destination.state,
        description: trip.destination.description,
        bestSeason: trip.destination.bestSeason,
        seasonalNotes: trip.destination.seasonalNotes,
        typicalDailyMinPaise: trip.destination.dailySpend ? trip.destination.dailySpend.min * 100 : null,
        typicalDailyMaxPaise: trip.destination.dailySpend ? trip.destination.dailySpend.max * 100 : null,
      },
      update: { name: trip.destination.name, state: trip.destination.state, description: trip.destination.description, bestSeason: trip.destination.bestSeason, seasonalNotes: trip.destination.seasonalNotes },
    });

    const uniquePlaces = new Map(trip.days.flatMap((day) => day.items.map((item) => [item.activity.place.id, item.activity.place] as const)));
    for (const place of uniquePlaces.values()) {
      await tx.place.upsert({
        where: { id: place.id },
        create: {
          id: place.id,
          destinationId: trip.destination.id,
          name: place.name,
          neighborhood: place.neighborhood,
          category: place.category.toUpperCase().replaceAll(" ", "_") as never,
          description: place.description,
          latitude: place.coordinates.latitude,
          longitude: place.coordinates.longitude,
          durationMin: place.durationMin,
          costMinPaise: place.priceKnown === false ? null : place.costMin * 100,
          costMaxPaise: place.priceKnown === false ? null : place.costMax * 100,
          openingHours: place.openingHours,
          bestTime: place.bestTime,
          etiquette: place.etiquette,
        },
        update: { name: place.name, neighborhood: place.neighborhood, description: place.description },
      });
    }

    const uniqueOptions = new Map(trip.days.flatMap((day) => day.items.flatMap((item) => item.transportation.map((option) => [option.id, option] as const))));
    for (const option of uniqueOptions.values()) {
      await tx.transportationOption.upsert({
        where: { id: option.id },
        create: { id: option.id, mode: option.mode, label: option.label, typicalSpeedKmh: option.typicalSpeedKmh, costMinPaise: option.priceKnown === false ? null : option.costMin * 100, costMaxPaise: option.priceKnown === false ? null : option.costMax * 100, notes: option.notes },
        update: { mode: option.mode, label: option.label, typicalSpeedKmh: option.typicalSpeedKmh, notes: option.notes },
      });
    }

    for (const day of trip.days) {
      for (const item of day.items) {
        await tx.activity.upsert({
          where: { id: item.activity.id },
          create: {
            id: item.activity.id,
            placeId: item.activity.place.id,
            title: item.activity.title,
            description: item.activity.description,
            timeOfDay: item.timeOfDay,
            durationMin: item.durationMin,
            costMinPaise: item.activity.place.priceKnown === false ? null : item.activity.costMin * 100,
            costMaxPaise: item.activity.place.priceKnown === false ? null : item.activity.costMax * 100,
            recommendedReason: item.activity.recommendedReason,
            transports: { create: item.transportation.map((option) => ({ transportationOptionId: option.id })) },
          },
          update: { title: item.activity.title, description: item.activity.description, durationMin: item.durationMin, recommendedReason: item.activity.recommendedReason },
        });
      }
    }

    await tx.trip.upsert({
      where: { id: trip.id },
      create: {
        id: trip.id,
        userId: trip.userId,
        destinationId: trip.destination.id,
        originCity: trip.originCity,
        startsOn: trip.startsOn ? new Date(`${trip.startsOn}T12:00:00`) : null,
        dayCount: trip.days.length,
        travelers: trip.travelers,
        travelStyle: trip.preferences.travelStyle,
        plannerPayload: serialized,
        days: { create: trip.days.map((day) => ({ id: day.id, dayNumber: day.dayNumber, title: day.title, neighborhood: day.neighborhood, routeKm: day.routeKm, items: { create: day.items.map((item) => ({ id: item.id, activityId: item.activity.id, transportationOptionId: item.transportation[0]?.id, sortOrder: item.sortOrder, title: item.activity.title, description: item.activity.description, category: item.activity.category, timeOfDay: item.timeOfDay, durationMin: item.durationMin, costPaise: item.activity.place.priceKnown === false ? null : item.cost * 100, distanceFromPreviousKm: item.distanceFromPreviousKm })) } })) },
        budget: { create: { currency: "INR", estimatedPaise: trip.budget.estimatedTotal * 100, perPersonPaise: trip.budget.perPerson * 100, dailyPaise: trip.budget.dailyAverage * 100, lines: { create: trip.budget.lines.map((line) => ({ category: line.category.toUpperCase().replaceAll(" ", "_") as never, amountPaise: line.amount * 100, notes: line.notes })) } } },
      },
      update: {
        plannerPayload: serialized,
        dayCount: trip.days.length,
        travelers: trip.travelers,
        travelStyle: trip.preferences.travelStyle,
        days: { deleteMany: {}, create: trip.days.map((day) => ({ id: day.id, dayNumber: day.dayNumber, title: day.title, neighborhood: day.neighborhood, routeKm: day.routeKm, items: { create: day.items.map((item) => ({ id: item.id, activityId: item.activity.id, transportationOptionId: item.transportation[0]?.id, sortOrder: item.sortOrder, title: item.activity.title, description: item.activity.description, category: item.activity.category, timeOfDay: item.timeOfDay, durationMin: item.durationMin, costPaise: item.cost * 100, distanceFromPreviousKm: item.distanceFromPreviousKm })) } })) },
        budget: { upsert: { create: { currency: "INR", estimatedPaise: trip.budget.estimatedTotal * 100, perPersonPaise: trip.budget.perPerson * 100, dailyPaise: trip.budget.dailyAverage * 100, lines: { create: trip.budget.lines.map((line) => ({ category: line.category.toUpperCase().replaceAll(" ", "_") as never, amountPaise: line.amount * 100, notes: line.notes })) } }, update: { estimatedPaise: trip.budget.estimatedTotal * 100, perPersonPaise: trip.budget.perPerson * 100, dailyPaise: trip.budget.dailyAverage * 100, lines: { deleteMany: {}, create: trip.budget.lines.map((line) => ({ category: line.category.toUpperCase().replaceAll(" ", "_") as never, amountPaise: line.amount * 100, notes: line.notes })) } } } },
      },
    });
  });
}
