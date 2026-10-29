"use client";

import { useRef } from "react";
import { Icon } from "@/components/icons";
import { RouteMap } from "@/components/route-map";
import { TripDNACard } from "@/components/trip-dna-card";
import type { ItineraryDay, ItineraryItem, Trip } from "@/lib/types";

type Props = {
  trip: Trip;
  activeDay: number;
  onSelectDay: (index: number) => void;
  onOptimize: () => void;
  onAdjustment: (name: "reduce-cost" | "relaxed" | "regenerate-day" | "add-day" | "nature" | "local-food" | "parents" | "remove-nightlife") => void;
  onAddExperience: () => void;
  onDuplicate: () => void;
  onActivityAction: (action: "remove" | "replace" | "move" | "duration" | "reorder", itemId: string, value?: string | number) => void;
  busy: boolean;
};

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const durationText = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes >= 120 ? "s" : ""}${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
const timeChoices: ItineraryItem["timeOfDay"][] = ["Morning", "Afternoon", "Evening", "Night"];

function DayTabs({ days, activeDay, onSelect }: { days: ItineraryDay[]; activeDay: number; onSelect: (index: number) => void }) {
  return <div className="day-tabs" role="tablist" aria-label="Trip days">{days.map((day, index) => <button key={day.id} type="button" role="tab" aria-selected={activeDay === index} className={`day-tab ${activeDay === index ? "active" : ""}`} onClick={() => onSelect(index)}><span>DAY {String(index + 1).padStart(2, "0")}</span><small>{day.title}</small></button>)}</div>;
}

function ActivityCard({ item, days, currentDay, onAction, onDragStart, onDrop }: { item: ItineraryItem; days: ItineraryDay[]; currentDay: number; onAction: Props["onActivityAction"]; onDragStart: (itemId: string) => void; onDrop: (itemId: string) => void }) {
  const durationOptions = [30, 45, 60, 90, 120, 150, 180, item.durationMin].filter((value, index, array) => array.indexOf(value) === index).sort((a, b) => a - b);
  return <article className="activity" draggable onDragStart={() => onDragStart(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => onDrop(item.id)}>
    <div className="activity-time"><span className="drag-grip" title="Drag to reorder">⠿</span>{item.timeOfDay}<small><select className="duration-select" aria-label={`Change duration for ${item.activity.title}`} value={item.durationMin} onChange={(event) => onAction("duration", item.id, Number(event.target.value))}>{durationOptions.map((minutes) => <option key={minutes} value={minutes}>{durationText(minutes)}</option>)}</select></small></div>
    <div className="activity-marker"><i/></div>
    <div className="activity-body">
      <div className="activity-title-row"><h4>{item.activity.title}</h4><div className="activity-actions"><button type="button" title="Move earlier" aria-label="Move earlier" onClick={() => onAction("reorder", item.id, -1)}>↑</button><button type="button" title="Move later" aria-label="Move later" onClick={() => onAction("reorder", item.id, 1)}>↓</button><button type="button" title="Use an alternative" aria-label="Use an alternative" onClick={() => onAction("replace", item.id)}>↻</button><button type="button" title="Remove activity" aria-label="Remove activity" onClick={() => onAction("remove", item.id)}>×</button></div></div>
      <p>{item.activity.description}</p>
      <div className="activity-meta"><span className="cost">{item.activity.place.priceKnown === false ? "Ticket price not listed" : item.activity.costMax ? `${money(item.activity.costMin)}–${money(item.activity.costMax)}` : "Free"}</span><span>{item.distanceFromPreviousKm === null ? "Distance unavailable" : `${item.distanceFromPreviousKm.toFixed(1)} km from previous`}</span><span>{item.travelMinutes === null ? "Route time unavailable" : `~${item.travelMinutes} min route`}</span><span>{item.transportation[0]?.label ?? "Local mode not verified"}</span><label>Move to <select aria-label={`Move ${item.activity.title} to another day`} value={currentDay} onChange={(event) => onAction("move", item.id, Number(event.target.value))}>{days.map((day, index) => <option key={day.id} value={index}>Day {index + 1}</option>)}</select></label></div>
      <div className="activity-why">Why it fits: {item.activity.recommendedReason}</div>
      <div className="activity-alt">↳ Alternatives: {item.activity.alternatives.join(" · ")}</div>
    </div>
  </article>;
}

export function ItineraryWorkspace(props: Props) {
  const { trip, activeDay, onSelectDay, busy } = props;
  const day = trip.days[activeDay];
  const dateSummary = trip.startsOn ? new Date(`${trip.startsOn}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : `${trip.days.length} days · dates flexible`;
  const draggedId = useRef("");
  return <>
    <div className="results-head"><div><div className="eyebrow muted"><span className="eyebrow-dot"/> YOUR TRIP, TAKING SHAPE</div><h2>{trip.destination.name}, <em>at your own pace.</em></h2><p>{trip.destination.state} · {trip.preferences.travelStyle} · your plan can change as you go.</p></div><button type="button" className="edit-button" onClick={() => document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" })}>← Edit trip details</button></div>
    <div className="summary-dashboard"><div className="summary-overview"><span>DESTINATION</span><b><Icon name="place"/>{trip.destination.name}</b></div><div className="summary-overview"><span>DATES</span><b><Icon name="calendar"/>{dateSummary}</b></div><div className="summary-overview"><span>TRAVELERS</span><b><Icon name="people"/>{trip.travelers} {trip.travelers === 1 ? "traveler" : "travelers"}</b></div><div className="summary-overview"><span>TRIP BUDGET TARGET</span><b><Icon name="rupee"/>{money(trip.budget.estimatedTotal)}</b><small>{money(trip.budget.perPerson)} / person</small></div><TripDNACard dna={trip.dna} compact/></div>
    <div className="workspace-actionbar"><button type="button" className="action-chip" onClick={props.onOptimize} disabled={busy}><Icon name="route"/> Optimize route</button><button type="button" className="action-chip" onClick={() => props.onAdjustment("reduce-cost")} disabled={busy}><Icon name="rupee"/> Reduce cost</button><button type="button" className="action-chip" onClick={() => props.onAdjustment("relaxed")} disabled={busy}><Icon name="relax"/> Make relaxed</button><button type="button" className="action-chip" onClick={props.onAddExperience}><Icon name="plus"/> Add experiences</button><button type="button" className="action-chip" onClick={() => props.onAdjustment("regenerate-day")} disabled={busy}><Icon name="spark"/> Regenerate Day {activeDay + 1}</button></div>
    <RouteMap items={day.items} destination={trip.destination.name} neighborhood={day.neighborhood} routeKm={day.routeKm} routeCoordinates={day.routeCoordinates} routeMode={day.routeMode} routeStatus={day.routeStatus}/>
    <div className="itinerary-layout"><DayTabs days={trip.days} activeDay={activeDay} onSelect={onSelectDay}/><section className="day-content"><div className="day-heading"><div><span className="map-kicker">DAY {String(day.dayNumber).padStart(2, "0")}</span><h3>{day.title}</h3><p>{day.neighborhood} · {day.items.length} stops · {day.routeStatus === "routed" ? `~${day.routeKm.toFixed(1)} km routed` : "Route distance unavailable"}</p></div><div className="day-heading-actions"><div className="day-total">{money(trip.budget.dailyTargetPerPerson)} / person / day</div><button type="button" onClick={props.onDuplicate}>Duplicate day</button><button type="button" onClick={() => props.onAdjustment("regenerate-day")} disabled={busy}><Icon name="spark" size={13}/> Refresh day</button></div></div>
      {day.items.map((item) => <ActivityCard key={item.id} item={item} days={trip.days} currentDay={activeDay} onAction={props.onActivityAction} onDragStart={(id) => { draggedId.current = id; }} onDrop={(id) => { if (draggedId.current && draggedId.current !== id) props.onActivityAction("reorder", draggedId.current, id); draggedId.current = ""; }}/>)}</section></div>
    <div className="plan-note"><Icon name="spark"/><div><strong>Local context, built into the plan</strong><p>{trip.notices[0]}</p></div></div>
    <div className="what-if-card"><div><span className="map-kicker">WHAT IF?</span><h3>Refine one part of the trip.</h3><p>We’ll keep the rest of your plan intact.</p></div><div className="what-if-actions">{[["nature", "More nature"], ["local-food", "Local food"], ["parents", "For parents"], ["remove-nightlife", "Remove nightlife"], ["add-day", "Add a day"]].map(([action, label]) => <button key={action} type="button" onClick={() => props.onAdjustment(action as Props["onAdjustment"] extends (name: infer A) => void ? A : never)} disabled={busy}>{label}</button>)}</div></div>
  </>;
}
