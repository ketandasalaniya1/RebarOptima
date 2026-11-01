import { notificationsApi } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerPushServiceWorker() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function subscribeToPushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  // 1. Request browser permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied.');
  }

  // 2. Fetch public VAPID key from backend
  const res = await notificationsApi.getVapidKey();
  if (!res.success || !res.publicKey) {
    throw new Error('Web Push notifications are not enabled on this platform.');
  }

  // 3. Register SW
  const registration = await registerPushServiceWorker();
  if (!registration) {
    throw new Error('Could not initialize service worker.');
  }

  // 4. Subscribe to push manager
  const convertedVapidKey = urlBase64ToUint8Array(res.publicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey,
  });

  // 5. Register with backend
  const subJson = subscription.toJSON();
  await notificationsApi.subscribe(subJson, navigator.userAgent);

  // If endpoint is Chrome/Edge Google FCM, also explicitly register to FCM tokens collection
  if (subJson.endpoint && subJson.endpoint.includes('/fcm/send/')) {
    const fcmToken = subJson.endpoint.split('/fcm/send/')[1];
    if (fcmToken) {
      await notificationsApi.registerFcmToken(fcmToken, 'web', navigator.userAgent).catch(() => {});
    }
  }

  return subscription;
}

/**
 * Automatically registers the logged-in user's device if permission is granted,
 * or optionally requests permission if promptIfDefault is true.
 */
export async function autoRegisterPushDevice(promptIfDefault = false) {
  if (!isPushSupported()) return false;
  try {
    let permission = Notification.permission;
    if (permission === 'default' && promptIfDefault) {
      permission = await Notification.requestPermission();
    }
    if (permission === 'granted') {
      await subscribeToPushNotifications();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Auto push registration error:', err.message);
    return false;
  }
}

export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await notificationsApi.unsubscribe(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
    return true;
  }
  return false;
}
