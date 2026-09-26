import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { siteUrl, type Content } from './content-api';

const key = `@matinf/read-posts/v1:${siteUrl}`;
const Context = createContext<{ read: Record<string, number>; ready: boolean; mark: (ids: number[]) => void }>({ read: {}, ready: false, mark: () => {} });
export function ReaderProvider({ children }: { children: ReactNode }) {
  const [read, setRead] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const current = useRef<Record<string, number>>({});
  const writes = useRef(Promise.resolve());
  useEffect(() => { let active = true; void AsyncStorage.getItem(key).then(raw => {
    if (!active) return;
    const parsed = raw ? JSON.parse(raw) : {};
    const saved = Object.fromEntries(Object.entries(parsed).filter(([id, timestamp]) => /^\d+$/.test(id) && typeof timestamp === 'number')) as Record<string, number>;
    current.current = { ...saved, ...current.current }; setRead(current.current);
  }).catch(() => {}).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  function mark(ids: number[]) {
    if (!ids.some(id => !current.current[id])) return;
    const next = { ...current.current };
    ids.forEach(id => { next[id] = Date.now(); });
    current.current = Object.fromEntries(Object.entries(next).sort((a, b) => b[1] - a[1]).slice(0, 500));
    setRead(current.current);
    const snapshot = JSON.stringify(current.current);
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, snapshot)).catch(() => {});
  }
  return <Context.Provider value={{ read, ready, mark }}>{children}</Context.Provider>;
}
export const useReadPosts = () => useContext(Context);
export function noticeLabel(item: Content) {
  if (item.meta.noticeKind) return ({ general: 'Opšte', exam: 'Ispiti', material: 'Materijali', schedule: 'Promjena rasporeda' })[item.meta.noticeKind];
  if (/ispit|rok|kolokvij/i.test(item.title)) return 'Ispiti';
  if (/raspored|termin|učionic/i.test(item.title)) return 'Raspored';
  return item.meta.attachments?.length ? 'Materijali' : 'Obavještenje';
}
