import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// SignIn anonymously on load to ensure there is a request.auth for rules
signInAnonymously(auth).catch(err => {
  if (err.code === 'auth/admin-restricted-operation') {
    console.warn("Anonymous auth belum diaktifkan di Firebase Console. Skor mungkin tidak bisa disimpan.");
  } else {
    console.error("Error signing in anonymously:", err);
  }
});

// Connection test as required by instructions
async function testConnection() {
  try {
    const testDoc = doc(db, '_connection_test_', 'ping');
    await getDocFromServer(testDoc);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
