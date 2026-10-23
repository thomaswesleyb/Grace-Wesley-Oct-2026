import { NavLink, Outlet, useLocation } from "react-router";
import { RandomBackdrop } from "@client/components/Backdrop.tsx";
import { site } from "@client/site.ts";

/** Home has its own fixed backdrop; admin is a plain working page. */
const OWN_BACKDROP = new Set(["/", "/admin"]);

export function Layout() {
  const { pathname } = useLocation();
  return (
    <>
      <header className="nav">
        <NavLink
          className="nav-monogram"
          to="/"
          aria-label={`${site.brideShort} and ${site.groomShort}: home`}
        >
          {site.brideShort[0]} &amp; {site.groomShort[0]}
        </NavLink>
        <nav aria-label="Main">
          <ul className="nav-links">
            <li>
              <NavLink to="/" end>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/qa">Info</NavLink>
            </li>
            <li>
              <NavLink to="/rsvp">RSVP</NavLink>
            </li>
            <li>
              <NavLink to="/photos">Photos</NavLink>
            </li>
            <li>
              <NavLink to="/labyrinth">Labyrinth</NavLink>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        {!OWN_BACKDROP.has(pathname) && <RandomBackdrop key={pathname} />}
        <Outlet />
      </main>
    </>
  );
}
