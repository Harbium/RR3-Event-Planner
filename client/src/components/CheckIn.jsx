import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardTitle, CardContent, CardDescription, CardHeader } from "./ui/card";
import { getAttendees, setAttendance } from "../api/events.js";

export default function CheckIn({ eventId }) {
  const [people, setPeople] = useState([]);

  useEffect(() => {
    getAttendees(eventId).then(setPeople).catch(console.error);
  }, [eventId]);

  async function toggle(id, arrived) {
    try {
      await setAttendance(eventId, id, !arrived); // only update the screen once the server has saved it
      setPeople((prev) =>
        prev.map((p) => (p.id === id ? { ...p, attended: !arrived } : p))
      );
    } catch (err) {
      console.error(err);
    }
  }

  const arrived = people.filter((p) => p.attended).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check In</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>Arrived: {arrived} / {people.length}</CardDescription>
        <ul>
          {people.map((p) => (
            <li key={p.id}>
              <span>
                {p.name} {p.dietary.length > 0 && `(${p.dietary.join(", ")})`}
              </span>
              <Button size="sm" onClick={() => toggle(p.id, p.attended)}>
                {p.attended ? "Undo" : "Arrived"}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}