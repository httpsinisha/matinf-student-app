export type PushDestination = { collection: 'news' | 'announcements'; id: number };

// Android SDK 57 also emits its token event when the existing token is fetched.
// Only a changed token should request another registration.
export function createTokenChangeListener(onChange: () => void) {
  let previous: string | undefined;
  return (token: unknown) => {
    const key = JSON.stringify(token);
    if (key === previous) return;
    previous = key;
    onChange();
  };
}

export function pushDestination(data: unknown, backend: string): PushDestination | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  if (value.version !== 1 || value.siteUrl !== backend ||
    (value.collection !== 'news' && value.collection !== 'announcements') ||
    typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0) return null;
  return { collection: value.collection, id: value.id };
}
