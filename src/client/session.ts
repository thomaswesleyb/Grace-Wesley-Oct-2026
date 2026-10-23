import { useEffect, useState } from "react";
import { apiFetch } from "@client/api.ts";
import { okResponse, sessionResponse, type SessionResponse } from "@shared/schemas.ts";

export type SessionGuest = NonNullable<SessionResponse["guest"]>;

/**
 * The guest this browser sent an RSVP as: undefined while loading, null when there's none or it
 * couldn't be loaded (the page then acts as if the visitor hasn't RSVPed). `signOut` forgets
 * the guest in this browser, for a shared device.
 */
export function useSession() {
  const [guest, setGuest] = useState<SessionGuest | null | undefined>(undefined);
  useEffect(() => {
    apiFetch("/api/session", sessionResponse)
      .then((reply) => setGuest(reply.guest))
      .catch((error: unknown) => {
        console.warn("Couldn't load the session:", error);
        setGuest(null);
      });
  }, []);
  const signOut = async () => {
    await apiFetch("/api/session", okResponse, { method: "DELETE" });
    setGuest(null);
  };
  return { guest, signOut };
}
