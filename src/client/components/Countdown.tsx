import { useEffect, useState } from "react";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
}

/** Whole days, hours and minutes until `target`; null once it has passed. */
export function remainingUntil(target: number, now: number): Remaining | null {
  const ms = target - now;
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / HOUR),
    minutes: Math.floor((ms % HOUR) / MINUTE),
  };
}

export function Countdown({ startsAt }: { startsAt: string }) {
  const target = Date.parse(startsAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const remaining = remainingUntil(target, now);
  if (remaining === null) return <p className="countdown-done">We're married!</p>;
  const units: [number, string][] = [
    [remaining.days, remaining.days === 1 ? "day" : "days"],
    [remaining.hours, remaining.hours === 1 ? "hour" : "hours"],
    [remaining.minutes, remaining.minutes === 1 ? "minute" : "minutes"],
  ];
  return (
    <dl className="countdown" aria-label="Time until the ceremony">
      {units.map(([value, label]) => (
        <div key={label}>
          <dt className="visually-hidden">{label}</dt>
          <dd>
            <span className="countdown-value">{value}</span>
            <span className="countdown-label">{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
