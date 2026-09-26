export type ReminderExam = { id?: string; courseId: number; course: { title: string }; startsAt?: string; room: string; date: string; start: string; year: number };
export type Reminder = { key: string; notificationId: string; scope: string; examId: string; title: string; room: string; startsAt: string; fireAt: number; minutes: number; programId: number; year: number; graduate: boolean };
export function reminderPlan(exam: ReminderExam, programId: number, year: number, graduate: boolean, minutes: number, now = Date.now()): Reminder {
  if (!exam.id || !exam.startsAt || !/(Z|[+-]\d\d:\d\d)$/.test(exam.startsAt)) throw new Error('Osvježite raspored prije uključivanja podsjetnika.');
  if (![60, 1440].includes(minutes)) throw new Error('Izaberite sat ili dan ranije.');
  const fireAt = Date.parse(exam.startsAt) - minutes * 60000;
  if (!Number.isFinite(fireAt) || fireAt <= now) throw new Error('Vrijeme za ovaj podsjetnik je već prošlo. Izaberite kasniji podsjetnik ili drugi ispit.');
  const scope = `${programId}:${graduate ? 'graduate' : year}`;
  const key = `${scope}:${exam.id}`;
  return { key, notificationId: 'matinf-exam-' + key, scope, examId: exam.id, title: exam.course.title, room: exam.room, startsAt: exam.startsAt, fireAt, minutes, programId, year, graduate };
}
