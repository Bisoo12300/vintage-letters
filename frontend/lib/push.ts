import { apiFetch } from '@/lib/api';
import type { AuthorId } from '@/lib/identity';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function ensurePushSubscription(author: AuthorId): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await registerServiceWorker();
    if (!reg) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await apiFetch<{ publicKey: string | null }>('/push/vapid-public-key', {
        author,
      });
      if (!publicKey) return;

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    await apiFetch('/push/subscribe', {
      method: 'POST',
      author,
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  } catch (err) {
    console.warn('[push] subscribe failed:', err);
  }
}

export async function syncAppBadge(count: number): Promise<void> {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
  try {
    if (count > 0) {
      await navigator.setAppBadge?.(count);
    } else {
      await navigator.clearAppBadge?.();
    }
  } catch {
    // Badging API unsupported/unavailable — ignore
  }
}
