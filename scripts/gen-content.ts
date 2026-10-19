import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildContent, parseDetails } from "./content.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const facts = parseDetails(readFileSync(`${root}DETAILS.md`, "utf8"));
const { content, hiddenQuestions, warnings } = buildContent(facts);

writeFileSync(`${root}content/details.json`, `${JSON.stringify(content, null, 2)}\n`);
console.log(`content/details.json: ${content.qa.length} Q&A entries shown.`);
for (const warning of warnings) console.warn(`warning: ${warning}`);
if (hiddenQuestions.length > 0) {
  console.log(`Hidden until DETAILS.md has the answer (${hiddenQuestions.length}):`);
  for (const question of hiddenQuestions) console.log(`  - ${question}`);
}
