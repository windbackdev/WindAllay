import { FetchedModel, fetchModels } from './fetcher.js';

let cachedModels: FetchedModel[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getModels(force = false): Promise<FetchedModel[]> {
  const now = Date.now();
  if (!force && cachedModels && now - lastFetch < CACHE_TTL) {
    return cachedModels;
  }
  cachedModels = await fetchModels();
  lastFetch = now;
  return cachedModels;
}

export function getModelById(id: string): FetchedModel | undefined {
  if (!cachedModels) return undefined;
  return cachedModels.find((m) => m.id === id);
}

export function invalidateCache(): void {
  cachedModels = null;
  lastFetch = 0;
}
