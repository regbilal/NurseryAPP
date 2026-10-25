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
let requestLang = 'en';

export function setRequestLang(lang: string) {
  requestLang = lang?.split('-')[0]?.toLowerCase() || 'en';
}

export function getRequestLang() {
  return requestLang;
}

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

function galleryFileNameFromPath(path: string, fallback = 'nursery-photo.jpg') {
  const segment = path.split('/').filter(Boolean).pop();
  if (!segment) return fallback;
  return segment.includes('.') ? segment : `${segment}.jpg`;
}

export async function downloadGalleryImage(path: string, suggestedName?: string) {
  const url = resolveAssetUrl(path);
  if (!url) throw new Error('Invalid image URL.');
  const fileName = suggestedName ?? galleryFileNameFromPath(path);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') throw new Error('Download is not available here.');
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Could not download the photo.');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error('File storage is not available on this device.');
  const dest = `${dir}${fileName}`;
  const result = await FileSystem.downloadAsync(url, dest, { headers });
  if (result.status !== 200) throw new Error('Could not download the photo.');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType: 'image/jpeg', dialogTitle: fileName });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
}

export async function fetchPublicBranding() {
  const res = await fetch(`${base}/api/branding/public`);
  if (!res.ok) return { logoUrl: null as string | null };
  return res.json() as Promise<{ logoUrl: string | null; name?: string }>;
}

export async function uploadGalleryPhoto(
  uri: string,
  childIds: string[],
  caption?: string,
  fileName = 'photo.jpg',
  mime = 'image/jpeg',
) {
  if (!childIds.length) throw new Error('Select at least one child.');
  const form = new FormData();
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Could not read the selected image.');
    const blob = await res.blob();
    if (!blob.size) throw new Error('The selected image is empty.');
    form.append('file', blob, fileName.endsWith('.') ? 'photo.jpg' : fileName);
  } else {
    form.append('file', { uri, name: fileName, type: mime } as any);
  }
  form.append('childIds', childIds.join(','));
  if (caption?.trim()) form.append('caption', caption.trim());
  form.append('kind', 'Photo');
  return api('/api/media', { method: 'POST', body: form });
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
  if (requestLang) headers['Accept-Language'] = requestLang;
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Cannot reach the API at ${base}. Start Nursery.Api (dotnet run) and check the API URL on the login screen.`);
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const body = JSON.parse(text) as { message?: string; title?: string };
      if (body.message) message = body.message;
      else if (body.title) message = body.title;
    } catch {
      /* plain text */
    }
    if (res.status === 404) message = `${message} — restart the API if you recently updated the app.`;
    throw new Error(message);
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
