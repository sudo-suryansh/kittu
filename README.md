# TravelSetu

TravelSetu is a Next.js App Router planner for practical trips around India. A live itinerary is generated from the traveller’s preferences, named place listings, and provider-calculated route geometry. The app does not silently substitute sample attractions or invented travel times when a provider is unavailable.

## Run locally

1. Install Node.js and dependencies: `npm install`
2. Create a free API key at [Groq](https://console.groq.com/keys) and a Geoapify key at [Geoapify](https://myprojects.geoapify.com/).
3. Copy `.env.example` to `.env.local` and add both keys. The default Groq model is `openai/gpt-oss-20b`.
4. Start the app: `npm run dev`, then open `http://localhost:3000`.

Both keys are needed for live itinerary generation. The app reports missing or rejected keys and provider errors directly. Geoapify’s free plan has a daily request allowance; map calls can stop working when its quota is reached. The base map uses visible OpenStreetMap tiles and displays contributor attribution.

PostgreSQL persistence is optional. To use it, set `DATABASE_URL` in `.env.local`, then run `npm run db:generate` and `npm run db:push`. Without a database, saved trips stay in the current browser.

## What the data means

- Groq selects and sequences activities from the exact place IDs returned by Geoapify. It cannot create place IDs. The generated itinerary is a suggestion; confirm venue hours and entry rules.
- Geoapify Places supplies destination listings, coordinates, and any provider-listed opening hours. Geoapify Routing supplies route geometry and approximate profile distance/time when a route is available. These are not live traffic or public-transport timetables.
- OpenStreetMap supplies map data and visible map tiles. Attribution is shown on the map.
- Ticket, restaurant, accommodation, train, bus and flight prices are not fetched. The Budget Planner divides the user’s entered target and labels it as a target, not a quote. Unknown prices remain unknown.
- Weather, festival calendars, verified local food advice, accessibility, safety conditions and regional etiquette are not checked live. The interface says when these details are not verified.
- Destination photographs are linked from Unsplash and credited in the interface.

## Architecture

- `app/` — pages and API route handlers
- `components/` — planner, map, itinerary, discovery, budget, and Trip DNA views
- `lib/types.ts` — domain types for users, destinations, places, activities, trips, itinerary days/items, transport, budgets and preferences
- `lib/live-planner.ts` — Groq structured itinerary generation, Geoapify discovery/routing and focused trip edits
- `lib/destination-data.ts` — destination index and credited destination photography (not a source of generated itinerary activities)
- `lib/repositories/` and `prisma/schema.prisma` — optional PostgreSQL persistence

## Providers

- [Groq API reference](https://console.groq.com/docs/api-reference)
- [Groq Structured Outputs](https://console.groq.com/docs/structured-outputs)
- [Geoapify Places API](https://apidocs.geoapify.com/docs/places/)
- [Geoapify Routing API](https://apidocs.geoapify.com/docs/routing/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
