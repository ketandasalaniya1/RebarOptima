import { App, initializeApp, getApps, deleteApp, cert } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { IFirebaseFcmConfig } from '../developer-console/developer.types';

let firebaseApp: App | null = null;
let currentProjectId = '';

export function getFirebaseAdminApp(config?: IFirebaseFcmConfig | null): App | null {
  const existingApps = getApps();
  if (!config || !config.enabled || !config.projectId || !config.clientEmail || !config.privateKey) {
    if (existingApps.length > 0) {
      return existingApps[0];
    }
    return null;
  }

  // Format private key correctly (handling escaped \n)
  let formattedPrivateKey = config.privateKey;
  if (formattedPrivateKey.includes('\\n')) {
    formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
  }

  // If already initialized with same project, return existing
  if (existingApps.length > 0 && currentProjectId === config.projectId) {
    return existingApps[0];
  }

  try {
    if (existingApps.length > 0) {
      for (const app of existingApps) {
        try {
          deleteApp(app);
        } catch {}
      }
    }

    firebaseApp = initializeApp({
      credential: cert({
        projectId: config.projectId.trim(),
        clientEmail: config.clientEmail.trim(),
        privateKey: formattedPrivateKey.trim(),
      }),
    });
    currentProjectId = config.projectId.trim();
    return firebaseApp;
  } catch (err: any) {
    console.error('Failed to initialize Firebase Admin SDK:', err.message);
    return null;
  }
}

export function getFirebaseMessaging(config?: IFirebaseFcmConfig | null): Messaging | null {
  const app = getFirebaseAdminApp(config);
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch (err: any) {
    console.error('Failed to get Firebase Messaging instance:', err.message);
    return null;
  }
}

export function resetFirebaseAdminApp() {
  const existingApps = getApps();
  for (const app of existingApps) {
    try {
      deleteApp(app);
    } catch {}
  }
  firebaseApp = null;
  currentProjectId = '';
}
