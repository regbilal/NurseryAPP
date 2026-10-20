import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API =
  Platform.OS === 'web'
    ? 'http://localhost:5285'
    : Platform.OS === 'android'
      ? 'http://10.0.2.2:5285'
      : 'http://localhost:5285';

let token: string | null = null;
let base = DEFAULT_API;

export function setToken(value: string | null) {
  token = value;
}

export function getToken() {
  return token;
}

export async function setBaseUrl(url: string) {
  base = url.replace(/\/$/, '');
  await AsyncStorage.setItem('apiUrl', base);
}

export async function loadBaseUrl() {
  const saved = await AsyncStorage.getItem('apiUrl');
  if (saved) base = saved;
  return base;
}

export function getBaseUrl() {
  return base;
}

export function resolveAssetUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function fetchPublicBranding() {
  const res = await fetch(`${base}/api/branding/public`);
  if (!res.ok) return { logoUrl: null as string | null };
  return res.json() as Promise<{ logoUrl: string | null; name?: string }>;
}

export async function uploadBrandingLogo(uri: string, fileName = 'logo.png', mime = 'image/png') {
  const form = new FormData();
  form.append('file', { uri, name: fileName, type: mime } as any);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/api/branding/logo`, { method: 'POST', headers, body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ logoUrl: string }>;
}

async function openHtmlFromApi(path: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const html = await res.text();
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
    return;
  }
  const { openBrowserAsync } = await import('expo-web-browser');
  await openBrowserAsync(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const QUEUE_KEY = 'offline-care-queue';

export async function enqueueCare(childId: string, payload: object) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const q = raw ? JSON.parse(raw) : [];
  q.push({ childId, payload, clientId: payload && (payload as any).clientId });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function openPaymentReceipt(invoiceId: string, lang: string) {
  await openHtmlFromApi(`/api/children/invoices/${invoiceId}/receipt?lang=${encodeURIComponent(lang)}`);
}

export async function openWeeklySummaryDocument(childId: string, lang: string) {
  await openHtmlFromApi(`/api/children/${childId}/weekly-summary/document?lang=${encodeURIComponent(lang)}`);
}

export async function flushQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const q: { childId: string; payload: any }[] = raw ? JSON.parse(raw) : [];
  const keep: typeof q = [];
  for (const item of q) {
    try {
      await api(`/api/children/${item.childId}/care`, {
        method: 'POST',
        body: JSON.stringify(item.payload),
      });
    } catch {
      keep.push(item);
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(keep));
  return keep.length;
}
