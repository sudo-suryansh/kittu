"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AboutPage, BudgetPlanner, DayDetail, DestinationExplorer, ExampleItinerary, IndiaGuide, LandingFooter, PreferencesPage, SavedTrips, TripDNAPage } from "@/components/trip-pages";
import { BrandMark, Icon } from "@/components/icons";
import { ItineraryWorkspace } from "@/components/itinerary-workspace";
import { TripPlannerForm } from "@/components/trip-planner-form";
import type { Destination, GenerateTripInput, ItineraryDay, ItineraryItemAction, Place, Trip, TripAdjustment } from "@/lib/types";

type AppPage = "landing" | "itinerary" | "day-page" | "explore" | "budget-page" | "dna-page" | "saved-page" | "preferences-page" | "india-page" | "about-page";
const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

function makeClientId() {
  const stored = window.localStorage.getItem("travelsetu-user-id");
  if (stored) return stored;
  const id = globalThis.crypto?.randomUUID?.() ?? `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem("travelsetu-user-id", id);
  return id;
}

function withTripBudget(trip: Trip, dailyTarget: number): Trip {
  const total = dailyTarget * trip.days.length * trip.travelers;
  const shares = [0.34, 0.18, 0.18, 0.1, 0.12, 0.08];
  return { ...trip, preferences: { ...trip.preferences, budgetPerDay: dailyTarget }, budget: { ...trip.budget, dailyTargetPerPerson: dailyTarget, dailyAverage: dailyTarget, perPerson: dailyTarget * trip.days.length, estimatedTotal: total, lines: trip.budget.lines.map((line, index) => ({ ...line, amount: Math.round(total * shares[index]) })) } };
}

export function TravelSetuApp({ exampleTrip }: { exampleTrip: Trip }) {
  const [page, setPage] = useState<AppPage>("landing");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<{ destinations: Destination[]; places: Place[] }>({ destinations: [], places: [] });
  const [selectedDestination, setSelectedDestination] = useState("Delhi");
  const [plannerDestination, setPlannerDestination] = useState("Jaipur");
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<{ aiPlannerReady: boolean; livePlaceAndRouteDataReady: boolean; databaseReady: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/destinations").then((response) => response.json()).then((data) => setCatalog(data)).catch(() => setError("We couldn’t load the destination list. You can still plan a trip by entering its name."));
    fetch("/api/status").then((response) => response.json()).then((data) => setIntegrationStatus(data)).catch(() => setIntegrationStatus(null));
    const saved = window.localStorage.getItem("travelsetu-trips");
    if (saved) { try { setSavedTrips(JSON.parse(saved) as Trip[]); } catch { window.localStorage.removeItem("travelsetu-trips"); } }
  }, []);

  const active = trip?.days[activeDay] ?? trip?.days[0];
  const explorePlaces = useMemo(() => catalog.places, [catalog.places]);

  async function createPlan(input: GenerateTripInput) {
    setBusy(true); setError("");
    try {
      const userId = makeClientId();
      const response = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, userId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "We couldn’t build that trip yet.");
      setTrip(data.trip as Trip); setCatalog((current) => ({ ...current, places: (data.trip as Trip).candidatePlaces ?? [] })); setSelectedDestination((data.trip as Trip).destination.name); setActiveDay(0); setPage("itinerary");
      window.setTimeout(() => document.getElementById("trip-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t build that trip yet."); }
    finally { setBusy(false); }
  }

  const adjust = useCallback(async (adjustment: TripAdjustment, dayIndex = activeDay, dailyTarget?: number, experience?: Place) => {
    if (!trip) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/trips/${trip.id}/adjust`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trip, adjustment, dayIndex, dailyTarget, experience }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "We couldn’t update that part of the trip.");
      setTrip(data.trip as Trip);
      if (adjustment === "add-day") setActiveDay((data.trip as Trip).days.length - 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t update that part of the trip."); }
    finally { setBusy(false); }
  }, [trip, activeDay]);

  async function editItem(action: ItineraryItemAction, itemId: string, value?: string | number) {
    if (!trip) return;
    if (action === "move" && Number(value) === activeDay) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/trips/${trip.id}/items`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trip, action, itemId, value, dayIndex: activeDay }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "That activity could not be updated.");
      setTrip(data.trip as Trip);
      if (action === "move" && typeof value === "number") setActiveDay(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "That activity could not be updated."); }
    finally { setBusy(false); }
  }

  async function changeExplorerDestination(slug: string) {
    const destination = catalog.destinations.find((item) => item.slug === slug);
    if (!destination) return;
    setSelectedDestination(destination.name);
    setPlannerDestination(destination.name);
    setExploreLoading(true); setError(""); setCatalog((current) => ({ ...current, places: [] }));
    setSearchResults([]);
    try {
      const response = await fetch(`/api/destinations?destination=${encodeURIComponent(slug)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Live place listings could not be loaded.");
      setCatalog(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Live place listings could not be loaded."); }
    finally { setExploreLoading(false); }
  }

  async function addPlace(place: Place) {
    if (!trip) { setError("Build a trip first, then add experiences to a day."); setPage("landing"); document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" }); return; }
    await adjust("experience", activeDay, undefined, place);
    setPage("itinerary");
  }

  async function searchCustomPlace(name: string) {
    const selected = trip?.destination ?? catalog.destinations.find((destination) => destination.name === selectedDestination);
    if (!selected?.coordinates) { setError("Select a mapped destination before searching for a place."); return; }
    setSearchingPlaces(true); setError(""); setSearchResults([]);
    try {
      const response = await fetch("/api/places/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: name, destinationId: trip?.destination.id ?? selected.id, coordinates: selected.coordinates }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Live place search failed.");
      setSearchResults(data.places as Place[]);
      if (!(data.places as Place[]).length) setError(`Geoapify returned no exact matches for “${name}” within 30 km.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Live place search failed."); }
    finally { setSearchingPlaces(false); }
  }

  function saveCurrentTrip() {
    if (!trip) return;
    const next = [trip, ...savedTrips.filter((item) => item.id !== trip.id)].slice(0, 12);
    setSavedTrips(next); window.localStorage.setItem("travelsetu-trips", JSON.stringify(next));
  }

  function loadSavedTrip(saved: Trip) {
    setTrip(saved); setActiveDay(0); setSelectedDestination(saved.destination.name); setPlannerDestination(saved.destination.name); setPage("itinerary");
    window.setTimeout(() => document.getElementById("trip-workspace")?.scrollIntoView({ behavior: "smooth" }), 60);
  }

  function duplicateDay() { void adjust("duplicate-day", activeDay); }

  function navigate(next: AppPage) {
    setPage(next); setError("");
    window.setTimeout(() => (next === "landing" ? document.getElementById("home") : document.getElementById("trip-workspace"))?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  }

  const isLanding = page === "landing";
  const workspaceTabs: { id: AppPage; label: string }[] = [
    { id: "itinerary", label: "Itinerary" }, { id: "day-page", label: "Day detail" }, { id: "explore", label: "Explore" }, { id: "budget-page", label: "Budget" },
    { id: "dna-page", label: "Trip DNA" }, { id: "saved-page", label: "Saved trips" }, { id: "preferences-page", label: "Preferences" }, { id: "india-page", label: "India guide" }, { id: "about-page", label: "About" },
  ];

  return <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
    <header className="topbar"><button className="brand" type="button" onClick={() => navigate("landing")} aria-label="TravelSetu home"><BrandMark/><span>travel<span className="brand-accent">setu</span></span></button><nav className="nav-links" aria-label="Main navigation"><button type="button" onClick={() => navigate("explore")}>Explore India</button><button type="button" onClick={() => navigate("about-page")}>About TravelSetu</button></nav><button type="button" className="nav-cta" onClick={() => { if (trip) navigate("itinerary"); else document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" }); }}>{trip ? "Your trip" : "Plan a trip"}<Icon name="arrow" size={15}/></button></header>

    {isLanding && <>
      <section className="hero" id="home"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> THOUGHTFUL TRIPS, MADE FOR INDIA</div><h1>Your India trip,<br/><em>planned around you.</em></h1><p className="hero-intro">Build smarter Indian itineraries based on your time, budget, interests and travel style.</p><div className="hero-buttons"><button type="button" className="submit-button" onClick={() => document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" })}>Plan My Trip <Icon name="arrow" size={16}/></button><button type="button" className="secondary-button" onClick={() => navigate("explore")}>Explore India <Icon name="place" size={16}/></button></div><div className="hero-notes"><span><b><Icon name="route" size={15}/></b> Routes that make sense</span><span><b><Icon name="spark" size={15}/></b> Your pace, your plan</span></div></div><div className="hero-art" role="img" aria-label="Hawa Mahal in Jaipur, Rajasthan"><div className="art-label label-one"><span>01</span> start anywhere</div><div className="art-label label-two"><span>02</span> find your own way</div><div className="art-stamp">INDIA<br/><small>IN GOOD TIME</small></div><div className="art-ground"><span>राजस्थान</span><i/><span>RAJASTHAN, INDIA</span></div><a className="photo-credit" href="https://unsplash.com/photos/ornate-pink-palace-facade-with-many-windows-Xy3VtQV3h2c" target="_blank" rel="noreferrer">Photo: Unsplash</a></div><a href="#planner" className="scroll-cue"><span>↓</span> YOUR TRIP STARTS HERE</a></section>
      {error && <p className="inline-error">{error}</p>}
      <section className="planner-section" id="planner"><div className="section-heading"><div><div className="eyebrow muted"><span className="eyebrow-dot"/> THE TRIP BUILDER</div><h2>Where to, <em>and how?</em></h2></div><p>Tell us a little about your trip. We’ll shape a plan that makes sense on the ground.</p></div>
        <div className="integration-state" role="status"><div className={`integration-chip ${integrationStatus?.aiPlannerReady ? "connected" : "missing"}`}><i/>{integrationStatus ? integrationStatus.aiPlannerReady ? "Groq AI key configured" : "Groq AI key missing" : "Checking Groq AI…"}</div><div className={`integration-chip ${integrationStatus?.livePlaceAndRouteDataReady ? "connected" : "missing"}`}><i/>{integrationStatus ? integrationStatus.livePlaceAndRouteDataReady ? "Geoapify live places configured" : "Geoapify key missing" : "Checking live place data…"}</div><div className="integration-chip connected"><i/>OpenStreetMap basemap · no key</div>{integrationStatus && (!integrationStatus.aiPlannerReady || !integrationStatus.livePlaceAndRouteDataReady) && <p>To generate real plans, add <code>{[!integrationStatus.aiPlannerReady && "GROQ_API_KEY", !integrationStatus.livePlaceAndRouteDataReady && "GEOAPIFY_API_KEY"].filter(Boolean).join(" and ")}</code> to <code>.env.local</code>, then restart the server. The map uses OpenStreetMap tiles and requires an internet connection.</p>}{integrationStatus?.databaseReady === false && <small>Trips save in this browser. PostgreSQL persistence is not configured.</small>}</div>
        <TripPlannerForm key={plannerDestination} defaultDestination={plannerDestination} onSubmit={createPlan} busy={busy}/></section>
      <ExampleItinerary day={exampleTrip.days[0]}/>
      <section className="how-section" id="how-it-works"><div className="eyebrow muted"><span className="eyebrow-dot"/> SIMPLE BY DESIGN</div><h2>Less tab-hopping.<br/><em>More being there.</em></h2><div className="how-grid"><article><span className="how-num">01</span><span className="how-icon"><Icon name="spark"/></span><h3>Start with your real trip</h3><p>Your budget, interests, dates, food and the people coming with you.</p></article><article><span className="how-num">02</span><span className="how-icon"><Icon name="route"/></span><h3>Make it make sense</h3><p>Trip DNA, nearby places, honest travel times, meal breaks and breathing room.</p></article><article><span className="how-num">03</span><span className="how-icon"><Icon name="edit"/></span><h3>Keep your options open</h3><p>Change one activity or one day at a time. Your trip stays yours.</p></article></div></section><LandingFooter/>
    </>}

    {!isLanding && <section id="trip-workspace" className="results-section"><div className="results-head"><div><div className="eyebrow muted"><span className="eyebrow-dot"/> TRAVELSETU WORKSPACE</div><h2>{trip ? `${trip.destination.name}, ` : "Explore India, "}<em>{trip ? "your way." : "one good day at a time."}</em></h2><p>{trip ? `${trip.days.length} days · ${trip.preferences.travelStyle} · ${trip.originCity} → ${trip.destination.name}` : "Browse destinations and experiences, then turn the ones you like into a plan."}</p></div>{trip && <button type="button" className="edit-button" onClick={() => navigate("landing")}>← Edit trip details</button>}</div>
      {trip && <nav className="workspace-nav" aria-label="Trip workspace">{workspaceTabs.map((tab) => <button key={tab.id} type="button" className={`workspace-tab ${page === tab.id ? "active" : ""}`} onClick={() => navigate(tab.id)}>{tab.label}</button>)}</nav>}
      {error && <p className="inline-error">{error}</p>}
      {page === "itinerary" && trip && <ItineraryWorkspace trip={trip} activeDay={activeDay} onSelectDay={setActiveDay} onOptimize={() => void adjust("optimize-route")} onAdjustment={(action) => void adjust(action)} onAddExperience={() => navigate("explore")} onDuplicate={duplicateDay} onActivityAction={(action, itemId, value) => void editItem(action, itemId, value)} busy={busy}/>}
      {page === "day-page" && trip && active && <DayDetail day={active} destination={trip.destination}/>}
      {page === "explore" && <DestinationExplorer destinations={catalog.destinations} places={explorePlaces} selectedDestination={selectedDestination} selectedDay={activeDay} onAdd={addPlace} onDestination={(slug) => void changeExplorerDestination(slug)} onSearchCustom={(query) => void searchCustomPlace(query)} searchResults={searchResults} searchingPlaces={searchingPlaces} loading={exploreLoading}/>}
      {page === "budget-page" && trip && (
        <BudgetPlanner trip={trip} onBudgetChange={(value) => {
          setTrip((current) => current ? withTripBudget(current, value) : current);
          void adjust("set-budget", activeDay, value);
        }}/>
      )}
      {page === "dna-page" && trip && <TripDNAPage dna={trip.dna} preferences={trip.preferences}/>}
      {page === "saved-page" && <SavedTrips trips={savedTrips} onLoad={loadSavedTrip} onSave={saveCurrentTrip} canSave={Boolean(trip)}/>}
      {page === "preferences-page" && <PreferencesPage trip={trip ?? undefined} onEdit={() => navigate("landing")}/>}
      {page === "india-page" && trip && <IndiaGuide destination={trip.destination} notices={trip.notices}/>}
      {page === "about-page" && <AboutPage/>}
      {busy && <div className="saving-indicator" role="status"><span/> Saving this change to your plan</div>}
    </section>}
    <footer className="site-footer"><button type="button" className="brand" onClick={() => navigate("landing")}><BrandMark/><span>travel<span className="brand-accent">setu</span></span></button><span>Made for the miles, meals & moments in between.</span><span>© TravelSetu 2026</span></footer>
  </main>;
}
