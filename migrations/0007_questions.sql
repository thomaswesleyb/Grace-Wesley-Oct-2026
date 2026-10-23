-- Q&A entries the couple adds from /admin/questions. They show on the Q&A page after the
-- questions built from DETAILS.md, under the same topic headings, oldest first.
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL CHECK (topic IN ('Getting there', 'Lodging', 'The day of', 'Registry & more')),
  question TEXT NOT NULL CHECK (length(question) > 0),
  answer TEXT NOT NULL CHECK (length(answer) > 0),
  created_at TEXT NOT NULL
);
