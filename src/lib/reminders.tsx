import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { fetchContent, siteUrl } from './content-api';
import { reminderPlan, type Reminder, type ReminderExam } from './reminder-model';

type Notifications = typeof import('expo-notifications');
const native = Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const storage = `@matinf/exam-reminders/v1:${siteUrl}`;
type Value = { records: Reminder[]; add: (exam: ReminderExam, programId: number, year: number, graduate: boolean, minutes: number) => Promise<void>; cancel: (key: string) => Promise<void>; reconcile: (exams: ReminderExam[], programId: number, year: number, graduate: boolean) => Promise<void> };
const Context = createContext<Value>({ records: [], add: async () => {}, cancel: async () => {}, reconcile: async () => {} });
export const useReminders = () => useContext(Context);
async function schedule(record: Reminder) {
  const api: Notifications = require('expo-notifications');
  const time = new Date(record.startsAt).toLocaleString('sr-Latn', { timeZone: 'Europe/Sarajevo', dateStyle: 'short', timeStyle: 'short' });
  await api.scheduleNotificationAsync({ identifier: record.notificationId, content: { title: 'Podsjetnik za ispit', body: `${record.title} · ${time} · ${record.room}`, sound: 'default', data: { version: 1, siteUrl, kind: 'exam-reminder', examId: record.examId, collection: 'schedule', programId: record.programId, year: record.year, scheduleMode: record.graduate ? 'graduate' : 'exams' } }, trigger: { type: api.SchedulableTriggerInputTypes.DATE, date: new Date(record.fireAt), channelId: 'exam-reminders' } });
}
export function ReminderProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<Reminder[]>([]);
  const current = useRef<Reminder[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  useEffect(() => { let active = true; queue.current = AsyncStorage.getItem(storage).then(raw => {
    const parsed = raw ? JSON.parse(raw) : [];
    if (active && Array.isArray(parsed)) { current.current = parsed.filter(row => row && typeof row.key === 'string' && typeof row.notificationId === 'string' && Number.isFinite(row.fireAt) && Date.parse(row.startsAt) > Date.now()); setRecords(current.current); }
  }).catch(() => {}).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  const commit = useCallback(async (next: Reminder[]) => { await AsyncStorage.setItem(storage, JSON.stringify(next)); current.current = next; setRecords(next); }, []);
  const serial = useCallback((work: () => Promise<void>) => { const next = queue.current.catch(() => {}).then(work); queue.current = next; return next; }, []);
  const cancel = useCallback((key: string) => serial(async () => {
    const record = current.current.find(row => row.key === key); if (!record) return;
    if (native) { const api: Notifications = require('expo-notifications'); await api.cancelScheduledNotificationAsync(record.notificationId); await api.dismissNotificationAsync(record.notificationId).catch(() => {}); }
    await commit(current.current.filter(row => row.key !== key));
  }), [commit, serial]);
  const add = useCallback((exam: ReminderExam, programId: number, year: number, graduate: boolean, minutes: number) => serial(async () => {
    if (!native) throw new Error('Podsjetnike uključite u instaliranoj Android aplikaciji.');
    const record = reminderPlan(exam, programId, year, graduate, minutes);
    const api: Notifications = require('expo-notifications');
    await api.setNotificationChannelAsync('exam-reminders', { name: 'Podsjetnici za ispite', importance: api.AndroidImportance.HIGH });
    const existing = await api.getPermissionsAsync();
    const permission = existing.granted || !existing.canAskAgain ? existing : await api.requestPermissionsAsync();
    if (!permission.granted) throw new Error('Dozvolite obavještenja u Android podešavanjima da biste primali podsjetnike.');
    const previous = current.current.find(row => row.key === record.key);
    await schedule(record);
    try { await commit([...current.current.filter(row => row.key !== record.key), record]); }
    catch (error) { await api.cancelScheduledNotificationAsync(record.notificationId); if (previous && previous.fireAt > Date.now()) await schedule(previous); throw error; }
  }), [commit, serial]);
  const reconcile = useCallback((exams: ReminderExam[], programId: number, year: number, graduate: boolean) => serial(async () => {
    if (!native) return;
    const scope = `${programId}:${graduate ? 'graduate' : year}`;
    let next = [...current.current]; let changed = false;
    const api: Notifications = require('expo-notifications');
    for (const record of current.current.filter(row => row.scope === scope)) {
      const exam = exams.find(row => row.id === record.examId);
      if (exam && exam.startsAt === record.startsAt && exam.room === record.room && exam.course.title === record.title) continue;
      await api.cancelScheduledNotificationAsync(record.notificationId);
      next = next.filter(row => row.key !== record.key); changed = true;
      if (exam) {
        let updated: Reminder | undefined;
        try { updated = reminderPlan(exam, programId, year, graduate, record.minutes); } catch { /* Removed or elapsed reminder stays cancelled. */ }
        if (updated) {
          try { await schedule(updated); next.push(updated); }
          catch (error) { await commit(next); throw error; }
        }
      }
    }
    if (changed) await commit(next);
  }), [commit, serial]);
  useEffect(() => {
    if (!ready || !native) return;
    const refresh = async () => {
      const scopes = [...new Map(current.current.map(row => [row.scope, row])).values()];
      for (const row of scopes) try {
        const data = await fetchContent<{ exams?: ReminderExam[]; graduateExams?: ReminderExam[] }>(`/schedule?program_id=${row.programId}&year=${row.year}&semester=1`);
        const exams = row.graduate ? data.graduateExams : data.exams;
        if (exams) await reconcile(exams, row.programId, row.year, row.graduate);
      } catch { /* Preserve alarms while offline. */ }
      // Android can clear alarms after a force-stop. Restore saved future reminders on reopening.
      await serial(async () => {
        // The SDK's stored request list is not proof that AlarmManager still has the alarm.
        // Scheduling the same identifier replaces it without duplicating notifications.
        for (const row of current.current) if (row.fireAt > Date.now()) await schedule(row);
      }).catch(() => {});
    };
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => subscription.remove();
  }, [ready, reconcile, serial]);
  return <Context.Provider value={{ records, add, cancel, reconcile }}>{children}</Context.Provider>;
}
