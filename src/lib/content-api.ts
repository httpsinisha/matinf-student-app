import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export const siteUrl = (process.env.EXPO_PUBLIC_WORDPRESS_URL || 'http://127.0.0.1:9400').replace(/\/$/, '');
export const apiUrl = `${siteUrl}/wp-json/matinf/v1`;
export type Collection = 'news' | 'announcements' | 'programs' | 'courses' | 'staff' | 'documents' | 'pages';
export type Related = { id: number; title: string; type: Collection; url: string };
export type Content = Related & {
  slug: string; excerpt: string; bodyHtml: string; publishedAt: string; updatedAt: string;
  image: { url: string; alt: string } | null;
  meta: { attachments?: { id: number; title: string; url: string; mimeType: string }[]; important?: boolean; authorName?: string; level?: string; durationYears?: number; ects?: number; programId?: number; year?: number; semester?: number; staffGroup?: string; academicTitle?: string; email?: string; fileUrl?: string; mimeType?: string; audience?: { everyone: boolean; programYears: string[]; courseIds: number[] } };
  relations: { program?: Related; staff?: Related[]; courses?: Related[]; documents?: Related[] };
};
export type Page = { items: Content[]; total: number; totalPages: number; page: number; perPage: number };
export type Catalog = { programs: Content[]; courses: Content[] };
export const levelLabel: Record<string, string> = { undergraduate: 'Osnovne studije', master: 'Master studije', doctoral: 'Doktorske studije' };

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function fetchContent<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(apiUrl + path, { signal: controller.signal });
    if (!response.ok) throw new ApiError(response.status, response.status === 404 ? 'Ovaj sadržaj više nije dostupan.' : 'Sadržaj trenutno nije moguće učitati.');
    return await response.json() as T;
  } finally { clearTimeout(timer); }
}

export function useContent<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++generation.current;
    const key = `@matinf/content/v1:${apiUrl}:${path}`;
    setLoading(true); setError(null); setMissing(false);
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached && run === generation.current) {
        try { const value = JSON.parse(cached); setData(value.data); setSavedAt(value.savedAt); } catch { /* Invalid local cache is replaced on success. */ }
      }
      const next = await fetchContent<T>(path);
      if (run !== generation.current) return;
      const timestamp = new Date().toISOString();
      setData(next); setSavedAt(timestamp); setOffline(false);
      await AsyncStorage.setItem(key, JSON.stringify({ data: next, savedAt: timestamp })).catch(() => undefined);
    } catch (cause) {
      if (run !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 404) {
        setData(null); setMissing(true); setOffline(false);
        await AsyncStorage.removeItem(key).catch(() => undefined);
      } else setOffline(true);
      setError(cause instanceof ApiError ? cause.message : 'Nema veze sa sajtom. Provjerite internet i pokušajte ponovo.');
    } finally { if (run === generation.current) setLoading(false); }
  }, [path]);
  useEffect(() => { setData(null); setSavedAt(null); setOffline(false); void refresh(); return () => { generation.current++; }; }, [refresh]);
  return { data, loading, offline, error, missing, savedAt, refresh };
}

export async function loadCatalog(): Promise<Catalog> {
  async function all(collection: Collection) {
    const items: Content[] = [];
    let page = 1;
    for (;;) {
      const result = await fetchContent<Page>(`/content/${collection}?per_page=50&page=${page}`);
      items.push(...result.items);
      if (page >= result.totalPages) return items;
      page++;
    }
  }
  return { programs: await all('programs'), courses: await all('courses') };
}
