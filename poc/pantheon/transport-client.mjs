import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, getDocFromServer, runTransaction } from 'firebase/firestore';

let app, db;
window.probe = {
  async authenticate() {
    performance.mark('probe:auth:start');
    app = initializeApp({apiKey:'demo-key',authDomain:'demo-pantheon.firebaseapp.com',projectId:'demo-pantheon',appId:'demo-pantheon'});
    const auth = getAuth(app);
    db = initializeFirestore(app,{useFetchStreams:true});
    connectAuthEmulator(auth,'http://127.0.0.1:9293',{disableWarnings:true});
    connectFirestoreEmulator(db,'127.0.0.1',8193);
    await auth.authStateReady();
    await signInAnonymously(auth);
    performance.mark('probe:auth:ready');
  },
  async listen() {
    performance.mark('probe:listen:start');
    const snapshot = await getDocFromServer(doc(db,'games','TRANSPORT'));
    if (!snapshot.exists()) throw new Error('Probe document missing');
    performance.mark('probe:listen:ready');
  },
  async transaction() {
    performance.mark('probe:transaction:start');
    const snapshot = await runTransaction(db,transaction=>transaction.get(doc(db,'games','TRANSPORT')));
    if (!snapshot.exists()) throw new Error('Probe transaction document missing');
    performance.mark('probe:transaction:ready');
  },
  async close() { await deleteApp(app); }
};
