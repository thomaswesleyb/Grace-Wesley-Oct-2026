import { Link } from "react-router";

export function NotFound() {
  return (
    <section className="page">
      <h1>Page not found</h1>
      <p className="lede">That page doesn't exist.</p>
      <div className="actions">
        <Link className="button" to="/">
          Back to the invitation
        </Link>
      </div>
    </section>
  );
}
