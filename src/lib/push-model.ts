export type PushDestination = { collection: 'news' | 'announcements'; id: number } | { collection: 'schedule'; programId: number; year: number; scheduleMode: 'exams' | 'graduate'; examId?: string };

export function isNotificationForPost(data: unknown, backend: string, postId: number): boolean {
  // News and announcements share WordPress post IDs, including dual-category posts.
  const destination = pushDestination(data, backend);
  return destination && destination.collection !== 'schedule' ? destination.id === postId : false;
}

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
  if (value.version === 1 && value.siteUrl === backend && value.kind === 'exam-reminder' && value.collection === 'schedule' &&
    typeof value.programId === 'number' && Number.isSafeInteger(value.programId) && value.programId > 0 &&
    typeof value.year === 'number' && Number.isInteger(value.year) && value.year >= 1 && value.year <= 6 &&
    (value.scheduleMode === 'exams' || value.scheduleMode === 'graduate')) return { collection: 'schedule', programId: value.programId, year: value.year, scheduleMode: value.scheduleMode, ...(typeof value.examId === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value.examId) ? { examId: value.examId } : {}) };
  if (value.version !== 1 || value.siteUrl !== backend ||
    (value.collection !== 'news' && value.collection !== 'announcements') ||
    typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0) return null;
  return { collection: value.collection, id: value.id };
}
