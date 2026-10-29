import type { TripDNA } from "@/lib/types";

const labels: [keyof TripDNA, string][] = [["adventure", "Adventure"], ["culture", "Culture"], ["relaxation", "Relaxation"], ["food", "Food"], ["nature", "Nature"], ["nightlife", "Nightlife"]];
const svgNumber = (value: number) => Number(value.toFixed(2));

export function TripDNACard({ dna, compact = false }: { dna: TripDNA; compact?: boolean }) {
  const entries = labels.map(([key, label]) => ({ label, value: dna[key] }));
  const points = entries.map((entry, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / entries.length;
    const radius = 20 + entry.value * .72;
    return `${svgNumber(110 + Math.cos(angle) * radius)},${svgNumber(110 + Math.sin(angle) * radius)}`;
  }).join(" ");
  const axes = entries.map((entry, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / entries.length;
    const x = svgNumber(110 + Math.cos(angle) * 101);
    const y = svgNumber(110 + Math.sin(angle) * 101);
    return <g key={entry.label}><line x1="110" y1="110" x2={x} y2={y}/><text x={svgNumber(110 + Math.cos(angle) * 108)} y={svgNumber(y + 4)} textAnchor="middle">{entry.label}</text></g>;
  });
  const strongest = [...entries].sort((a, b) => b.value - a.value).slice(0, 2).map((entry) => entry.label.toLowerCase());

  if (compact) return <aside className="trip-dna-mini"><div className="dna-mini-heading"><span className="map-kicker">YOUR TRIP DNA</span><b>{strongest.join(" + ")}</b></div><div className="dna-mini-bars">{entries.map((item) => <div className="dna-row" key={item.label}><span>{item.label}</span><div><i style={{ width: `${item.value}%` }}/></div><b>{item.value}%</b></div>)}</div></aside>;

  return <div className="dna-layout"><div className="dna-card"><div className="dna-graphic"><svg viewBox="0 0 220 220" aria-label="Trip DNA radar profile"><polygon points="110,20 188,65 188,155 110,200 32,155 32,65" fill="none" stroke="#e5e8df"/><polygon points="110,50 162,80 162,140 110,170 58,140 58,80" fill="none" stroke="#e5e8df"/>{axes}<polygon points={points} fill="#86aa91" fillOpacity=".3" stroke="#1e6957" strokeWidth="2.5"/></svg></div><div className="dna-bars">{entries.map((item) => <div className="dna-row" key={item.label}><span>{item.label}</span><div><i style={{ width: `${item.value}%` }}/></div><b>{item.value}%</b></div>)}</div></div><aside className="dna-explainer"><span className="map-kicker">WHY THIS ROUTE FITS</span><h3>A {strongest.join(" + ").toLowerCase()} kind of trip.</h3><p>Your interests and pace shape the places, neighbourhoods and pauses in this plan. The scores are a planning profile, and you can change the plan at any point.</p><div className="dna-preference"><span>TRAVEL STYLE</span><b>Chosen in your trip preferences</b><span>ACTIVITY MATCH</span><b>Each stop shows why it fits</b></div></aside></div>;
}
