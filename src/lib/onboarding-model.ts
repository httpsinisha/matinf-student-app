export type Preferences = {
  version: 1;
  completed: true;
  programYears: string[];
  courseIds: string[];
  notificationsRequested: boolean;
  permission: "granted" | "denied" | "unavailable" | "not-requested";
  syncStatus: "pending" | "not-needed";
  backend?: string;
  selectedProgramId?: string;
};

// Older installations only saved followed years/courses. Restore their program too.
export function restoreProgramId(preferences: Pick<Preferences, 'programYears' | 'courseIds' | 'selectedProgramId'> | null, programs: { id: string }[], courses: { id: string; programId: string }[]): string {
  const candidates = [preferences?.selectedProgramId,
    ...(preferences?.programYears ?? []).map(value => value.split(':')[0]),
    ...(preferences?.courseIds ?? []).map(id => courses.find(course => course.id === id)?.programId)];
  return candidates.find(id => programs.some(program => program.id === id)) ?? programs[0]?.id ?? '';
}

export function toggleSelection(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function scheduleFollowing(preferences: Pick<Preferences, 'programYears' | 'courseIds'>, programs: { id: number; meta: { durationYears?: number; level?: string } }[], courses: { id: number; meta: { programId?: number | null; year?: number } }[]) {
  const valid = (programId: number, year: number) => Number.isInteger(year) && year >= 1 && programs.some(p => p.id === programId && year <= (p.meta.durationYears || 0));
  for (const choice of preferences.programYears) {
    const [programId, year] = choice.split(':').map(Number);
    if (valid(programId, year)) return { programId, year };
  }
  for (const id of preferences.courseIds) {
    const course = courses.find(c => String(c.id) === id);
    if (course?.meta.programId && course.meta.year && valid(course.meta.programId, course.meta.year)) return { programId: course.meta.programId, year: course.meta.year };
  }
  return { programId: (programs.find(p => p.meta.level === 'undergraduate') || programs[0])?.id || 0, year: 1 };
}

export function followedCourses<T extends { id: string; programId: string; year: number }>(programYears: string[], courseIds: string[], courses: T[]): T[] {
  const years = new Set(programYears);
  const individual = new Set(courseIds);
  return [...new Map(courses.filter(course => individual.has(course.id) || years.has(`${course.programId}:${course.year}`)).map(course => [course.id, course])).values()];
}

export function parsePreferences(raw: string | null): Preferences | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || value.completed !== true ||
      !Array.isArray(value.programYears) || !value.programYears.every((id: unknown) => typeof id === "string") ||
      !Array.isArray(value.courseIds) || !value.courseIds.every((id: unknown) => typeof id === "string") ||
      typeof value.notificationsRequested !== "boolean" ||
      (value.selectedProgramId !== undefined && typeof value.selectedProgramId !== 'string') ||
      !["granted", "denied", "unavailable", "not-requested"].includes(value.permission) ||
      !["pending", "not-needed"].includes(value.syncStatus)) return null;
    return value;
  } catch {
    return null;
  }
}
