import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelSetu — Your India trip, planned around you",
  description: "Build smarter Indian itineraries around your time, budget, interests and travel style.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
