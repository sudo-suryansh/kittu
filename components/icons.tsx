import type { ReactNode, SVGProps } from "react";

export type IconName = "route" | "place" | "origin" | "calendar" | "people" | "rupee" | "transport" | "stay" | "culture" | "relax" | "food" | "adventure" | "spiritual" | "family" | "nature" | "nightlife" | "photo" | "comfort" | "luxury" | "arrow" | "edit" | "close" | "clock" | "plus" | "menu" | "save" | "spark" | "train" | "walk" | "pin";

const paths: Record<IconName, ReactNode> = {
  route: <><path d="M5 18c3-8 7-11 11-8 2 2 3 5 7 2"/><circle cx="5" cy="18" r="2"/><circle cx="23" cy="12" r="2"/></>,
  place: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  origin: <><path d="M5 19 19 5M8 5h11v11"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1Zm13-9a3 3 0 1 0-1-5.8M18 15a5 5 0 0 1 3 4.5v.5"/></>,
  rupee: <><path d="M6 5h12M6 9h12M8 5c6 0 6 8 0 8H6l9 7"/></>,
  transport: <><path d="M4 16V7l2-3h12l2 3v9M4 11h16M7 16v3m10-3v3M7 13h.01M17 13h.01"/><path d="M6 7h12"/></>,
  stay: <><path d="M4 20V5h16v15M4 13h16M7 9h3v2H7zm7 0h3v2h-3zM9 20v-4h6v4"/></>,
  culture: <><path d="M4 20V8l8-4 8 4v12M2 20h20M8 20v-6h8v6M8 9h.01M16 9h.01"/></>,
  relax: <><path d="M4 15c2-4 5-4 8 0 3-4 6-4 8 0M5 20h14M12 3v5m-4-3 4 3 4-3"/></>,
  food: <><path d="M4 3v7m4-7v7M4 7h4m-2 3v11m8-18v18m0-18c5 2 5 8 0 9"/></>,
  adventure: <><path d="m4 18 6-12 4 8 3-5 3 9H4Z"/><path d="m9 10 2 2 2-2"/></>,
  spiritual: <><path d="M12 3v18M4 12h16M6 6l12 12M18 6 6 18"/><circle cx="12" cy="12" r="8"/></>,
  family: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20a6 6 0 0 1 12 0m1-5a5 5 0 0 1 7 4"/></>,
  nature: <><path d="M20 4C9 4 4 8 4 15c0 3 2 5 5 5 7 0 11-5 11-16Z"/><path d="M4 21c3-5 7-8 12-11"/></>,
  nightlife: <><path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"/><path d="m16 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></>,
  photo: <><path d="M4 7h4l2-2h4l2 2h4v13H4z"/><circle cx="12" cy="13" r="3.5"/></>,
  comfort: <><path d="M4 14v-3a3 3 0 0 1 6 0v3m0-2h7a3 3 0 0 1 3 3v4H4v-5m0 5v2m16-2v2"/></>,
  luxury: <><path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9z"/></>,
  arrow: <><path d="M5 19 19 5M8 5h11v11"/></>,
  edit: <><path d="m4 16-.8 4.8L8 20l11-11-4-4zM13 7l4 4"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  plus: <><path d="M12 5v14m-7-7h14"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  save: <><path d="M5 4h12l3 3v13H4V4zm3 0v6h8V4m-7 16v-6h8v6"/></>,
  spark: <><path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/></>,
  train: <><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M8 7h8v5H8zM8 22l2-3m6 3-2-3M5 15h14"/></>,
  walk: <><circle cx="14" cy="5" r="2"/><path d="m11 22 2-6-3-3 2-5 4 3 3 1m-9 1-4 4m5-8-4 5"/></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
};

export function Icon({ name, size = 18, className, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>{paths[name]}</svg>;
}

export function BrandMark({ className = "" }: { className?: string }) {
  return <span className={`brand-mark ${className}`} aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M8 27.5c5.5-9.8 10.7-13.9 16-12.2 3.8 1.2 5.2 5.4 8 4.5"/><circle cx="8" cy="28" r="3"/><circle cx="32" cy="20" r="3"/><path d="M19 14.5 23.5 10"/></svg></span>;
}
