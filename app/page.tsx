import { TravelSetuApp } from "@/components/travelsetu-app";
import { generateTrip } from "@/lib/planner";

export default function HomePage() {
  const exampleTrip = generateTrip({
    userId: "travelsetu-example",
    destination: "Delhi",
    originCity: "Jaipur",
    dayCount: 3,
    travelers: 2,
    travelStyle: "Culture & colour",
    interests: ["Architecture", "Local food", "History"],
    preferredTransport: "Metro & local transit",
    foodPreference: "Anything, especially local",
    accommodation: "Suggest what fits",
    budgetPerDay: 3000,
  });
  return <TravelSetuApp exampleTrip={exampleTrip}/>;
}
