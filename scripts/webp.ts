import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";

/** Fails with install instructions when ImageMagick isn't available. */
export function requireImageMagick(purpose: string): void {
  try {
    execFileSync("convert", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      `ImageMagick's \`convert\` isn't installed, so ${purpose} can't be built. Install it with \`sudo apt install imagemagick\`.`,
    );
  }
}

function isFresh(output: string, input: string): boolean {
  return existsSync(output) && statSync(output).mtimeMs >= statSync(input).mtimeMs;
}

/**
 * Converts to WebP, fixing camera rotation and stripping metadata (including GPS). Skips the
 * work when `output` is newer than `input`. `size` is an ImageMagick geometry; ">" only shrinks.
 */
export function toWebp(input: string, output: string, size: string, quality = 82): void {
  if (isFresh(output, input)) return;
  execFileSync("convert", [
    `${input}[0]`,
    "-auto-orient",
    "-strip",
    "-resize",
    size,
    "-quality",
    String(quality),
    output,
  ]);
}

export function dimensions(file: string): { width: number; height: number } {
  const [width, height] = execFileSync("identify", ["-format", "%w %h", file], {
    encoding: "utf8",
  })
    .trim()
    .split(" ")
    .map(Number);
  if (!width || !height) throw new Error(`Couldn't read the size of ${file}.`);
  return { width, height };
}

/** Deletes the .webp files in `dir` that aren't in `keep` (copies of removed photos). */
export function removeStaleWebp(dir: string, keep: Set<string>): void {
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".webp") && !keep.has(file)) unlinkSync(`${dir}/${file}`);
  }
}
