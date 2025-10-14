export function getRapidApiKey(request?: Request): string | undefined {
  const fromHeader = request?.headers.get('x-rapidapi-key') || undefined;
  return fromHeader || process.env.RAPIDAPI_KEY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
}

export async function rapidApiGetJson(url: string, apiKey: string, host: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': host,
    },
    // RapidAPI often requires GET without cache for fresh metrics
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RapidAPI error ${res.status}: ${text}`);
  }
  return res.json();
}


