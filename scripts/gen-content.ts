import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildContent, parseDetails } from "./content.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const facts = parseDetails(readFileSync(`${root}DETAILS.md`, "utf8"));
const { content, hiddenQuestions, warnings } = buildContent(facts);

writeFileSync(`${root}content/details.json`, `${JSON.stringify(content, null, 2)}\n`);
const shown = content.qa.length - hiddenQuestions.length;
console.log(`content/details.json: ${shown} Q&A entries shown.`);
for (const warning of warnings) console.warn(`warning: ${warning}`);
if (hiddenQuestions.length > 0) {
  console.log(
    `Hidden until DETAILS.md or /admin/questions answers them (${hiddenQuestions.length}):`,
  );
  for (const question of hiddenQuestions) console.log(`  - ${question}`);
}
