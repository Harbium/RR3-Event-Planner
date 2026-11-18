import {useState, useEffect} from 'react';
import {Card, CardTitle, CardContent, CardDescription, CardHeader} from './ui/card';

export default function Reports() {
    const [events, setEvents] =  useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/reports/events')
            .then((res) => {
                if (!res.ok) 
                    throw new Error("Failed to load report");
                return res.json();
                })
                .then(setEvents)
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
            }, []);
            
            const totals = events.reduce(
                (t, e) => ({
                    registtered: t.registered + e.registered,
                    attended: t.attended + e.attended,
                    volunteers_needed: t.volunteers_needed + e.volunteers_needed,
                    volunteers_booked: t.volunteers_booked + e.volunteers_booked,
                }),
                { registered: 0, attended: 0, volunteers_needed: 0, volunteers_booked: 0 }
            );

            if (loading) return <p>Loading...</p>;
            if (error) return <p role="alert">{error}</p>;

            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Events Reports</CardTitle>
                        <CardDescription>
                        {events.length} events · {totals.attended} / {totals.registered} attended ·{" "}
                        {totals.volunteersBooked} / {totals.volunteersNeeded} volunteer slots filled
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <table>
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Date</th>
                                    <th>Registred / Capacity</th>
                                    <th>Predicted</th>
                                    <th>Attended</th>
                                    <th>Volunteers</th>
                                    <th>Dietary</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((e) => (
                                    <tr key ={e.id}>
                                        <td>{e.name}</td>
                                        <td>{new Date(e.start).toLocaleString()}</td>
                                        <td>{e.registered} / {e.capacity}</td>
                                        <td>{e.predicted}</td>
                                        <td>{e.attended} 
                                            {e.registered > 0 && ` (${Math.round((e.attended / e.registered) * 100)}%)`}
                                        </td>
                                        <td>{e.volunteers_booked} / {e.volunteers_needed}</td>
                                        <td>{Object.entries(e.dietary).map(([name, count]) => `${name}: ${count}`).join(', ') || "None"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )
}       