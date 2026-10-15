/**
 * Resolves an Unsplash image for a keyword query.
 * With UNSPLASH_ACCESS_KEY set, the top search result is fetched from the Unsplash API
 * (cached for a day). Without a key, a curated Unsplash photo is used instead.
 */
const CURATED: Record<string, string> = {
  "modern clean interior architecture": "photo-1629909613654-28e377c37b09",
  "modern dental clinic interior": "photo-1606811841689-23dfddce3e95",
  "abstract soft blue waves": "photo-1505118380757-91f5f5632de0",
  "dentist consultation minimal": "photo-1588776814546-1ffcf47267a5",
};
const DEFAULT_PHOTO = "photo-1629909613654-28e377c37b09";

function sized(base: string, width: number) {
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}auto=format&fit=crop&w=${width}&q=80`;
}

export async function getUnsplashImage(query: string, width = 1600): Promise<string> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (accessKey) {
    try {
      const url = `https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&content_filter=high&query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Client-ID ${accessKey}` },
        next: { revalidate: 86_400 },
      });
      if (response.ok) {
        const data = (await response.json()) as { results?: { urls?: { raw?: string } }[] };
        const raw = data.results?.[0]?.urls?.raw;
        if (raw) return sized(raw, width);
      }
    } catch {
      // Fall through to the curated image.
    }
  }
  return sized(`https://images.unsplash.com/${CURATED[query] ?? DEFAULT_PHOTO}`, width);
}
