import { Link } from 'react-router';
import { Card, CardTitle, CardDescription, CardHeader } from './ui/card';
import AttendanceTrendChart from './reports/AttendanceTrendChart';
import RatesTrendChart from './reports/RatesTrendChart';
import VenueComparisonChart from './reports/VenueComparisonChart';
import ForecastAccuracyChart from './reports/ForecastAccuracyChart';
import ForecastBiasChart from './reports/ForecastBiasChart';
import MealDemandChart from './reports/MealDemandChart';
import MealWasteChart from './reports/MealWasteChart';
import DietaryTrendChart from './reports/DietaryTrendChart';
import DietaryByVenueChart from './reports/DietaryByVenueChart';
import VolunteerCoverageChart from './reports/VolunteerCoverageChart';
import UpcomingForecast from './reports/UpcomingForecast';
import { getReportOverview } from '../api/reports.js';
import { useFetch } from '../hooks/useFetch.js';
import { percent } from '../lib/format.js';

// A plain assembly of the report components, so there is one page to see them all.
// Each chart fetches its own data, so any of them can be used on any page on its own.
export default function Reports() {
    const { data, loading, error } = useFetch(getReportOverview);

    return (
        <>
            <Link to="/">Back to events</Link>
            <h1>Reports</h1>

            {loading && <p>Loading...</p>}
            {error && <p role="alert">{error}</p>}
            {data && (
                <Card>
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                        <CardDescription>
                            {data.summary.totalEvents} events ({data.summary.pastEvents} held, {data.summary.upcomingEvents} upcoming) ·{" "}
                            {data.summary.pastAttended} of {data.summary.pastRegistered} registered people attended
                            ({percent(data.summary.pastAttended, data.summary.pastRegistered)}) ·{" "}
                            {data.summary.pastVolunteersBooked} of {data.summary.pastVolunteersNeeded} volunteer slots filled
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            <h2>Coming up</h2>
            <UpcomingForecast />

            <h2>Attendance</h2>
            <AttendanceTrendChart />
            <RatesTrendChart />
            <VenueComparisonChart />

            <h2>Forecasting</h2>
            <ForecastAccuracyChart />
            <ForecastBiasChart />

            <h2>Meals</h2>
            <MealDemandChart />
            <MealWasteChart />

            <h2>Dietary requirements</h2>
            <DietaryTrendChart />
            <DietaryByVenueChart />

            <h2>Volunteers</h2>
            <VolunteerCoverageChart />
        </>
    );
}
