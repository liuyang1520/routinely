export function normalizedPageUrl(value: string): string {
  // Preserve query and fragment: these can identify different articles or SPA routes.
  return new URL(value).href;
}
