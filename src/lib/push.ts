import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { apiUrl, siteUrl } from './content-api';
import type { Preferences } from './onboarding-model';
import { createTokenChangeListener, isNotificationForPost, pushDestination, type PushDestination } from './push-model';

type Notifications = typeof import('expo-notifications');
type Identity = { id: string; secret: string };
const identityKey = 'matinf.push.installation.v1';
const native = Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
export const pushMessages = {
  off: 'Push obavještenja su isključena.',
  syncing: 'Povezivanje obavještenja…',
  ready: 'Push je uključen za vaš sačuvani izbor.',
  paused: 'Izbor je povezan. Slanje na sajtu još nije uključeno.',
  denied: 'Android dozvola nije odobrena. Uključite je u podešavanjima telefona.',
  setup: 'Push još nije podešen u ovoj verziji aplikacije.',
  unavailable: 'Push zahtijeva instaliranu Android aplikaciju.',
  error: 'Povezivanje nije uspjelo. Izbor je sačuvan; pokušajte ponovo.',
  stopping: 'Isključivanje nije potvrđeno na sajtu. Povežite se i pokušajte ponovo.',
};
type Status = keyof typeof pushMessages;

async function identity(create: boolean): Promise<Identity | null> {
  const secure: typeof import('expo-secure-store') = require('expo-secure-store');
  const stored = await secure.getItemAsync(identityKey);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (typeof parsed.id === 'string' && /^[a-f0-9]{64}$/.test(parsed.secret)) return parsed;
    throw new Error('Invalid installation identity');
  }
  if (!create) return null;
  const crypto: typeof import('expo-crypto') = require('expo-crypto');
  const bytes = await crypto.getRandomBytesAsync(32);
  const value = { id: crypto.randomUUID(), secret: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
  await secure.setItemAsync(identityKey, JSON.stringify(value));
  return value;
}

async function registration(device: Identity, preferences?: Preferences, token?: string) {
  const response = await fetch(`${apiUrl}/push/installation/${device.id}`, {
    method: preferences ? 'PUT' : 'DELETE',
    headers: { 'Content-Type': 'application/json', 'X-MATINF-Installation-Secret': device.secret },
    body: preferences ? JSON.stringify({ token, programYears: preferences.programYears, courseIds: preferences.courseIds }) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Push registration failed');
  return response.json() as Promise<{ enabled: boolean; deliveryEnabled?: boolean }>;
}

async function sync(preferences: Preferences): Promise<Status> {
  if (!native) return preferences.notificationsRequested ? 'unavailable' : 'off';
  if (!preferences.notificationsRequested) {
    const device = await identity(false);
    if (device) await registration(device);
    return 'off';
  }
  if (!projectId || !Constants.expoConfig?.extra?.matinfPushConfigured) return 'setup';
  const notifications: Notifications = require('expo-notifications');
  await notifications.setNotificationChannelAsync('academic', { name: 'Akademska obavještenja', importance: notifications.AndroidImportance.DEFAULT });
  const permission = await notifications.getPermissionsAsync();
  if (!permission.granted) {
    const device = await identity(false);
    if (device) await registration(device);
    return 'denied';
  }
  const device = (await identity(true))!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const token = await Promise.race([
    notifications.getExpoPushTokenAsync({ projectId }).then(result => result.data),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Push token timeout')), 20000); }),
  ]).finally(() => clearTimeout(timer));
  const result = await registration(device, preferences, token);
  return result.deliveryEnabled ? 'ready' : 'paused';
}

export async function changePushPreference(preferences: Preferences, enabled: boolean): Promise<Preferences> {
  let permission: Preferences['permission'] = preferences.permission;
  if (enabled) {
    if (!native) permission = 'unavailable';
    else {
      const notifications: Notifications = require('expo-notifications');
      await notifications.setNotificationChannelAsync('academic', { name: 'Akademska obavještenja', importance: notifications.AndroidImportance.DEFAULT });
      const existing = await notifications.getPermissionsAsync();
      const result = existing.granted || !existing.canAskAgain ? existing : await notifications.requestPermissionsAsync();
      permission = result.granted ? 'granted' : 'denied';
    }
  }
  return { ...preferences, notificationsRequested: enabled, permission, syncStatus: enabled ? 'pending' : 'not-needed' };
}

export function useDismissPostNotifications(postId: number | undefined) {
  useEffect(() => {
    if (!native || !postId) return;
    const notifications: Notifications = require('expo-notifications');
    let active = true;
    const dismiss = async () => {
      if (!active || AppState.currentState !== 'active') return;
      const presented = await notifications.getPresentedNotificationsAsync();
      if (!active || AppState.currentState !== 'active') return;
      await Promise.allSettled(presented
        .filter(item => isNotificationForPost(item.request.content.data, siteUrl, postId))
        .map(item => notifications.dismissNotificationAsync(item.request.identifier)));
    };
    void dismiss().catch(() => undefined);
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void dismiss().catch(() => undefined);
    });
    return () => { active = false; foreground.remove(); };
  }, [postId]);
}

export function usePush(preferences: Preferences | null, onOpen: (destination: PushDestination) => void) {
  const [status, setStatus] = useState<Status>('off');
  const current = useRef(preferences);
  current.current = preferences;
  const pending = useRef(Promise.resolve());
  const alive = useRef(true);
  const retry = useCallback(() => {
    // Serialize preference changes so a delayed old registration cannot overwrite opt-out.
    pending.current = pending.current.catch(() => undefined).then(async () => {
      const value = current.current;
      if (!value || !alive.current) return;
      setStatus('syncing');
      try { const next = await sync(value); if (alive.current) setStatus(next); }
      catch { if (alive.current) setStatus(value.notificationsRequested ? 'error' : 'stopping'); }
    });
  }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { retry(); }, [preferences, retry]);
  useEffect(() => {
    if (!native) return;
    const notifications: Notifications = require('expo-notifications');
    notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    const response = async (event: import('expo-notifications').NotificationResponse) => {
      if (event.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const target = pushDestination(event.notification.request.content.data, siteUrl);
      if (!target) return;
      const key = `@matinf/push-opened:${siteUrl}`;
      const id = `${event.notification.request.identifier}:${event.notification.date}`;
      if (await AsyncStorage.getItem(key) === id) return;
      await AsyncStorage.setItem(key, id);
      onOpen(target);
      await notifications.clearLastNotificationResponseAsync();
    };
    const listener = notifications.addNotificationResponseReceivedListener(event => { void response(event).catch(() => undefined); });
    void notifications.getLastNotificationResponseAsync().then(event => { if (event) return response(event); }).catch(() => undefined);
    const tokenListener = notifications.addPushTokenListener(createTokenChangeListener(retry));
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') retry(); });
    return () => { listener.remove(); tokenListener.remove(); foreground.remove(); };
  }, [onOpen, retry]);
  useEffect(() => {
    if (!['error', 'stopping'].includes(status)) return;
    const timer = setTimeout(() => { if (AppState.currentState === 'active') retry(); }, 60000);
    return () => clearTimeout(timer);
  }, [status, retry]);
  return { status, message: pushMessages[status], retry };
}
