"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Coordinates, ItineraryItem } from "@/lib/types";

type MapStop = { id: string; name: string; coordinates: Coordinates };
type DestinationPoint = { id: string; name: string; coordinates: Coordinates };
type Props = {
  items?: ItineraryItem[];
  places?: DestinationPoint[];
  destination: string;
  neighborhood?: string;
  routeKm?: number;
  routeCoordinates?: [number, number][];
  routeMode?: string;
  routeStatus?: "routed" | "unavailable" | "not-requested";
  compact?: boolean;
};

const tileSize = 256;
const svgNumber = (value: number) => Number(value.toFixed(2));
function project({ latitude, longitude }: Coordinates, zoom: number) {
  const size = tileSize * 2 ** zoom;
  const lat = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180;
  return { x: ((longitude + 180) / 360) * size, y: (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * size };
}
function unproject(x: number, y: number, zoom: number): Coordinates {
  const size = tileSize * 2 ** zoom;
  const longitude = x / size * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / size;
  return { longitude, latitude: 180 / Math.PI * Math.atan(Math.sinh(n)) };
}

function OpenMap({ stops, routeCoordinates, routeStatus, height, label }: { stops: MapStop[]; routeCoordinates?: [number, number][]; routeStatus?: Props["routeStatus"]; height: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 760, height });
  const [zoomOffset, setZoomOffset] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect?.width) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const map = useMemo(() => {
    const points = stops.map((stop) => project(stop.coordinates, 17));
    if (!points.length) return { zoom: 5, center: { x: 0, y: 0 } };
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const rawSpanX = Math.max(1, maxX - minX), rawSpanY = Math.max(1, maxY - minY);
    const usableWidth = Math.max(120, size.width - 150), usableHeight = Math.max(90, size.height - 110);
    const fit = Math.min(usableWidth / rawSpanX, usableHeight / rawSpanY);
    const fitZoom = Math.floor(17 + Math.log2(Math.max(1e-8, fit)));
    const zoom = Math.max(3, Math.min(17, fitZoom + zoomOffset));
    const scale = 2 ** (zoom - 17);
    return { zoom, center: { x: ((minX + maxX) / 2) * scale, y: ((minY + maxY) / 2) * scale } };
  }, [stops, size.width, size.height, zoomOffset]);

  const bounds = useMemo(() => {
    const left = map.center.x - size.width / 2;
    const top = map.center.y - size.height / 2;
    const minTileX = Math.floor(left / tileSize), maxTileX = Math.floor((left + size.width) / tileSize);
    const minTileY = Math.floor(top / tileSize), maxTileY = Math.floor((top + size.height) / tileSize);
    const count = 2 ** map.zoom;
    const tiles: { key: string; url: string; x: number; y: number; left: number; top: number }[] = [];
    for (let y = Math.max(0, minTileY); y <= Math.min(count - 1, maxTileY); y++) {
      for (let x = minTileX; x <= maxTileX; x++) {
        const wrappedX = ((x % count) + count) % count;
        tiles.push({ key: `${map.zoom}/${wrappedX}/${y}`, url: `https://tile.openstreetmap.org/${map.zoom}/${wrappedX}/${y}.png`, x, y, left: x * tileSize - left, top: y * tileSize - top });
      }
    }
    const screen = (coords: Coordinates) => {
      const point = project(coords, map.zoom);
      return { x: point.x - left, y: point.y - top };
    };
    return { tiles, screen, left, top };
  }, [map, size.width, size.height]);

  const stopPoints = stops.map((stop) => bounds.screen(stop.coordinates));
  const routePoints = routeCoordinates?.map(([longitude, latitude]) => bounds.screen({ latitude, longitude })) ?? [];
  const linePoints = routePoints.length > 1 ? routePoints : stopPoints;
  const pointString = linePoints.map((point) => `${svgNumber(point.x)},${svgNumber(point.y)}`).join(" ");

  return <div className="open-map" ref={ref} style={{ height }} role="img" aria-label={label}>
    <div className="map-tiles" aria-hidden="true">{bounds.tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" draggable={false} style={{ left: tile.left, top: tile.top }}/>)}</div>
    <svg className="map-overlay" width={size.width} height={size.height} aria-hidden="true">
      {linePoints.length > 1 && <polyline points={pointString} fill="none" stroke={routeCoordinates?.length ? "#246f5e" : "#e17d5e"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={routeCoordinates?.length ? undefined : "6 7"} opacity=".9"/>}
      {stops.map((stop, index) => {
        const point = stopPoints[index];
        const edge = index === 0 ? "start" : index === stops.length - 1 ? "end" : "stop";
        return <g key={stop.id} transform={`translate(${svgNumber(point.x)} ${svgNumber(point.y)})`}>
          <circle className={`map-pin map-pin-${edge}`} r="13"/>
          <text className="map-pin-number" textAnchor="middle" y="4">{index + 1}</text>
          <text className="map-pin-label" textAnchor={point.x < size.width - 140 ? "start" : "end"} x={point.x < size.width - 140 ? 18 : -18} y="-18">{stop.name.length > 24 ? `${stop.name.slice(0, 22)}…` : stop.name}</text>
        </g>;
      })}
    </svg>
    <div className="map-controls" aria-label="Map zoom controls"><button type="button" aria-label="Zoom in" onClick={() => setZoomOffset((value) => Math.min(4, value + 1))}>+</button><button type="button" aria-label="Zoom out" onClick={() => setZoomOffset((value) => Math.max(-4, value - 1))}>−</button></div>
    <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  </div>;
}

export function RouteMap(props: Props) {
  const stops: MapStop[] = props.items?.map((item) => ({ id: item.id, name: item.activity.title, coordinates: item.activity.place.coordinates })) ?? props.places ?? [];
  const title = props.neighborhood || `${props.destination} places to explore`;
  const liveRoute = props.routeStatus === "routed" && Boolean(props.routeCoordinates?.length);
  const status = liveRoute ? `${props.routeMode || "Road"} route · ${props.routeKm?.toFixed(1)} km` : props.routeStatus === "unavailable" ? "Road routing unavailable · markers use real map coordinates" : "Example stop sequence · straight-line connectors";
  return <section className={`map-card ${props.compact ? "map-card-compact" : ""}`} aria-label={`Map for ${title}`}>
    <div className="map-heading"><div><span className="map-kicker">{props.compact ? "EXAMPLE ROUTE" : "SMART DAY BUILDER · LIVE MAP"}</span><h3>{props.compact ? `A sample day in ${props.destination}` : title}</h3><p>{props.compact ? "Illustrative stop order; create a trip for a provider-routed itinerary." : `${props.destination} · real place coordinates on an OpenStreetMap basemap.`}</p></div><span className="map-distance">{props.items?.length ?? stops.length} stops</span></div>
    <OpenMap stops={stops} routeCoordinates={liveRoute ? props.routeCoordinates : undefined} routeStatus={props.routeStatus} height={props.compact ? 210 : 300} label={`${props.destination} map showing ${stops.map((stop) => stop.name).join(", ")}`}/>
    <div className="map-legend"><span><i className="legend-start"/>Start</span><span><i className="legend-stop"/>Stop</span><span><i className="legend-end"/>Finish</span><span className="map-disclaimer">{status}</span></div>
  </section>;
}
