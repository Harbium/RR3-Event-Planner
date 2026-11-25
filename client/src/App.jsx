import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import Dashboard from "./pages/Dashboard";
import EventInfomation from "./pages/EventInfo";
import StyleGuide from "./pages/StyleGuide";

// Loaded only when someone opens /reports, so the charting library is not part of the main bundle.
const Reports = lazy(() => import("./components/Reports"));


export default function App() {
  return (
		<Suspense fallback={<p>Loading...</p>}>
			<Routes>
				<Route path="/" element={<Dashboard />} />
				<Route path="/events/:id" element={<EventInfomation />} />
				<Route path="/reports" element={<Reports />} />
				   <Route path="/style-guide" element={<StyleGuide />} />
			</Routes>
		</Suspense>
	)
}
