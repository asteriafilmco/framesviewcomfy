import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!serviceAccount) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export const db = admin.firestore();