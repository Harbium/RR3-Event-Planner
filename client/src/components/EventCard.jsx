import { Card, CardTitle, CardContent, CardDescription, CardHeader } from "./ui/card";
import { formatDate, formatTime } from "../lib/format";

// `event` is the API's event shape (see server/API.md)
export default function EventCard({ event }) {
    const stats = [
        { label: "Registered", value: `${event.registered} / ${event.capacity}` },
        { label: "Attended", value: event.attended },
        { label: "Predicted", value: event.predicted },
        { label: "Volunteers", value: `${event.volunteers.booked} / ${event.volunteers.needed}` },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>{event.name}</CardTitle>
                <CardDescription>
                    {event.location.name} · {formatDate(event.start)}, {formatTime(event.start)}–{formatTime(event.end)}
                </CardDescription>
            </CardHeader>

            <CardContent className={"flex flex-wrap justify-between gap-2"}>
                {stats.map((s) => (
                    <div key={s.label}>
                        <p className={"text-sm"}>{s.label}</p>
                        <p className={"text-lg"}>{s.value}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
