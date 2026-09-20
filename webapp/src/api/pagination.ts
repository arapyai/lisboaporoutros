/** Collect bounded API pages, including a final empty page for exact multiples. */
export async function collectPages<T>(fetchPage: (page: number, perPage: number) => Promise<T[]>): Promise<T[]> {
  const perPage = 100;
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await fetchPage(page, perPage);
    items.push(...batch);
    if (batch.length < perPage) return items;
  }
}
