import { NavLink, Outlet } from "react-router";
import { site } from "@client/site.ts";

export function Layout() {
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
            <li>
              <NavLink to="/registry">Registry</NavLink>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
