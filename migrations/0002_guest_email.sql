-- Address the invitation is emailed to. Separate from invitations.email, which is the address a
-- guest types when they RSVP. Never sent to the RSVP page.
ALTER TABLE guests ADD COLUMN email TEXT;
