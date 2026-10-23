import { cleanRetailerLink } from "@shared/registry.ts";
import { parseCsv } from "./csv.ts";
import { sql } from "./sql.ts";

export const REGISTRY_COLUMNS = ["item", "price", "link"] as const;
/** Optional: `image` is a path under public/ (e.g. "registry/espresso.webp"). */
export const OPTIONAL_REGISTRY_COLUMNS = ["image", "description"] as const;

export interface SeedRegistryItem {
  id: string;
  name: string;
  priceCents: number;
  link: string | null;
  image: string | null;
  description: string | null;
  sort: number;
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Accepts "700", "1130.5", "$1,130.00". */
export function parsePriceCents(value: string, line: number): number {
  const cleaned = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned) || Number(cleaned) <= 0) {
    throw new Error(`Line ${line}: price must be a dollar amount above zero, got "${value}".`);
  }
  return Math.round(Number(cleaned) * 100);
}

function parseLink(value: string, line: number): string | null {
  const v = value.trim();
  if (v === "") return null;
  try {
    return cleanRetailerLink(v);
  } catch {
    throw new Error(`Line ${line}: link "${v.slice(0, 60)}" isn't a valid URL.`);
  }
}

function parseImage(value: string): string | null {
  const v = value
    .trim()
    .replace(/^\/+/, "")
    .replace(/^public\//, "");
  return v === "" ? null : `/${v}`;
}

export function buildRegistryItems(text: string): SeedRegistryItem[] {
  const [header, ...rows] = parseCsv(text);
  const columns = header?.map((h) => h.trim().toLowerCase()) ?? [];
  const missing = REGISTRY_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `Registry CSV is missing columns: ${missing.join(", ")}. Expected: Item,Price,Link`,
    );
  }
  type Column = (typeof REGISTRY_COLUMNS)[number] | (typeof OPTIONAL_REGISTRY_COLUMNS)[number];
  const ids = new Map<string, number>();
  return rows.map((row, index) => {
    const line = index + 2;
    const col = (name: Column) => (row[columns.indexOf(name)] ?? "").trim();
    const name = col("item");
    if (!name) throw new Error(`Line ${line}: Item is required.`);
    const id = slugify(name);
    const earlier = ids.get(id);
    if (earlier !== undefined)
      throw new Error(`Line ${line}: "${name}" duplicates line ${earlier}.`);
    ids.set(id, line);
    return {
      id,
      name,
      priceCents: parsePriceCents(col("price"), line),
      link: parseLink(col("link"), line),
      image: parseImage(col("image")),
      description: col("description") || null,
      sort: index,
    };
  });
}

/** Upserts by id, so re-running after editing the CSV updates items without touching gifts. */
export function buildRegistrySql(items: SeedRegistryItem[]): string {
  const lines = items.map(
    (i) =>
      `INSERT INTO registry_items (id, name, description, image, price_cents, link, sort) VALUES (${sql(i.id)}, ${sql(i.name)}, ${sql(i.description)}, ${sql(i.image)}, ${i.priceCents}, ${sql(i.link)}, ${i.sort}) ON CONFLICT (id) DO UPDATE SET name = excluded.name, description = excluded.description, image = excluded.image, price_cents = excluded.price_cents, link = excluded.link, sort = excluded.sort;`,
  );
  return `${lines.join("\n")}\n`;
}
