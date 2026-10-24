-- The couple's edits to the Q&A questions built from DETAILS.md, made from /admin/questions.
-- `key` is the entry's key in content/qa.ts. A row replaces that entry's topic, question and
-- answer on the Q&A page, or hides it; deleting the row goes back to the DETAILS.md version.
CREATE TABLE question_edits (
  key TEXT PRIMARY KEY,
  topic TEXT NOT NULL CHECK (topic IN ('Getting there', 'Lodging', 'The day of', 'Registry & more')),
  question TEXT NOT NULL CHECK (length(question) > 0),
  answer TEXT NOT NULL CHECK (length(answer) > 0),
  hidden INTEGER NOT NULL CHECK (hidden IN (0, 1)),
  updated_at TEXT NOT NULL
);
