import EventCard from "./EventCard.jsx";
import { Link } from "react-router";
import { Button } from "./ui/button";

// A list of event cards, each with a button to open the event.
// The page decides the heading (so it fits the page's heading levels); `title` is optional.
function EventsList({ events, title }) {
    return (
        <section>
            {title && <h2 className="text-lg">{title}</h2>}
            {events.length === 0 && <p>No events to show.</p>}
            {events.map((event) => (
                <div key={event.id} className="mb-2">
                    <EventCard event={event} />

                    <Button
                        variant="outline"
                        size="lg"
                        className="w-full"
                        nativeButton={false}
                        render={<Link to={`/events/${event.id}`} />}
                    >Open Event</Button>
                </div>
            ))}
        </section>
    )
}

export default EventsList;
