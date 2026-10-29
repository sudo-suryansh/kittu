"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import type { GenerateTripInput, TravelStyle } from "@/lib/types";

const styles: { name: TravelStyle; icon: IconName }[] = [
  { name: "Culture & colour", icon: "culture" }, { name: "Slow & relaxed", icon: "relax" }, { name: "Comfort", icon: "comfort" }, { name: "Luxury", icon: "luxury" },
  { name: "Food trail", icon: "food" }, { name: "Adventure", icon: "adventure" }, { name: "Nature", icon: "nature" }, { name: "Spiritual", icon: "spiritual" },
  { name: "Nightlife", icon: "nightlife" }, { name: "Family", icon: "family" }, { name: "Budget backpacker", icon: "walk" }, { name: "Photography", icon: "photo" },
];
const interestOptions = ["Architecture", "Local food", "Markets", "Nature", "History", "Art & craft", "Temples", "Nightlife"];

type Props = { onSubmit: (input: GenerateTripInput) => Promise<void>; busy: boolean; defaultDestination?: string };

export function TripPlannerForm({ onSubmit, busy, defaultDestination = "Jaipur" }: Props) {
  const [destination, setDestination] = useState(defaultDestination);
  const [originCity, setOriginCity] = useState("Mumbai");
  const [startsOn, setStartsOn] = useState("");
  const [dayCount, setDayCount] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [budgetPerDay, setBudgetPerDay] = useState(3000);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>("Culture & colour");
  const [interests, setInterests] = useState<string[]>(["Architecture"]);
  const [preferredTransport, setPreferredTransport] = useState("Whatever works best");
  const [foodPreference, setFoodPreference] = useState("Anything, especially local");
  const [accommodation, setAccommodation] = useState("Suggest what fits");

  function toggleInterest(interest: string) {
    setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);
  }

  return (
    <form id="planner-form" className="planner-card" onSubmit={(event) => {
      event.preventDefault();
      void onSubmit({ userId: "", destination, originCity, startsOn: startsOn || undefined, dayCount, travelers, budgetPerDay, travelStyle, interests, preferredTransport, foodPreference, accommodation });
    }}>
      <div className="form-topline"><div className="step-badge">01 <span>/</span> 02</div><div><strong>Start with the essentials</strong><small>We’ll build around the details that matter to you.</small></div><span className="required-note">A FEW DETAILS, A BETTER PLAN</span></div>
      <div className="form-grid">
        <label className="field field-destination"><span>Where are you headed?</span><div className="input-wrap"><Icon name="place" className="input-icon"/><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Try Jaipur, Goa, Kochi…" list="destination-options" required minLength={2}/><datalist id="destination-options"><option>Jaipur</option><option>Goa</option><option>Varanasi</option><option>Kochi</option><option>Delhi</option></datalist></div></label>
        <label className="field"><span>Starting from</span><div className="input-wrap"><Icon name="origin" className="input-icon"/><input value={originCity} onChange={(event) => setOriginCity(event.target.value)} placeholder="Your city" required minLength={2}/></div></label>
        <label className="field"><span>How long?</span><div className="input-wrap"><Icon name="calendar" className="input-icon"/><select value={dayCount} onChange={(event) => setDayCount(Number(event.target.value))}>{[2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n} days</option>)}</select></div></label>
        <label className="field"><span>When are you going?</span><div className="input-wrap"><Icon name="calendar" className="input-icon"/><input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} aria-label="Trip start date"/></div></label>
        <label className="field"><span>Who’s coming?</span><div className="input-wrap"><Icon name="people" className="input-icon"/><select value={travelers} onChange={(event) => setTravelers(Number(event.target.value))}>{[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n === 1 ? "Just me" : n === 6 ? "6+ travelers" : `${n} travelers`}</option>)}</select></div></label>
        <label className="field"><span>Approx. budget <small>per person / day</small></span><div className="input-wrap"><Icon name="rupee" className="input-icon"/><select value={budgetPerDay} onChange={(event) => setBudgetPerDay(Number(event.target.value))}><option value={1500}>Under ₹1,500</option><option value={3000}>₹1,500–3,000</option><option value={6000}>₹3,000–6,000</option><option value={12000}>₹6,000+</option></select></div></label>
        <label className="field"><span>Getting around</span><div className="input-wrap"><Icon name="transport" className="input-icon"/><select value={preferredTransport} onChange={(event) => setPreferredTransport(event.target.value)}>{["Whatever works best", "Train", "Bus", "Flight", "Metro & local transit", "Cab / self-drive"].map((value) => <option key={value}>{value}</option>)}</select></div></label>
        <label className="field"><span>Where to stay?</span><div className="input-wrap"><Icon name="stay" className="input-icon"/><select value={accommodation} onChange={(event) => setAccommodation(event.target.value)}>{["Suggest what fits", "Hostel / homestay", "Budget hotel", "Comfort hotel", "Boutique / heritage", "Luxury stay", "With friends / family"].map((value) => <option key={value}>{value}</option>)}</select></div></label>
      </div>
      <div className="choice-row"><div className="choice-label"><span>Your travel style</span><small>Pick the mood of your trip</small></div><div className="chips">{styles.map(({ name, icon }) => <button key={name} type="button" className={`chip ${travelStyle === name ? "selected" : ""}`} aria-pressed={travelStyle === name} onClick={() => setTravelStyle(name)}><Icon name={icon} size={14}/>{name}</button>)}</div></div>
      <div className="choice-row compact"><div className="choice-label"><span>Things you love</span><small>Choose a few</small></div><div className="chips interests">{interestOptions.map((interest) => <button key={interest} type="button" className={`chip ${interests.includes(interest) ? "selected" : ""}`} aria-pressed={interests.includes(interest)} onClick={() => toggleInterest(interest)}>{interest}</button>)}</div></div>
      <div className="form-bottom"><label className="food-field"><span>Food preferences</span><select value={foodPreference} onChange={(event) => setFoodPreference(event.target.value)}>{["Anything, especially local", "Vegetarian", "Vegan", "Jain", "Halal", "Regional food only", "No preference"].map((value) => <option key={value}>{value}</option>)}</select></label><button className="submit-button" type="submit" disabled={busy}>{busy ? "Building your trip…" : "Build my itinerary"}<Icon name="arrow" size={16}/></button><span className="privacy-note">Thoughtful planning, no booking pressure.</span></div>
    </form>
  );
}
