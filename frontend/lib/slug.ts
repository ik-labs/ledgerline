/** Turn a customer name into a URL-friendly slug. e.g. "Atlas Mapping Co." -> "atlas-mapping-co" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
