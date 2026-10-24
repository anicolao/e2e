import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, getDocFromServer, runTransaction, writeBatch, serverTimestamp, collection, query, orderBy, onSnapshot } from 'firebase/firestore';

let app, db, uid, room = 'TRANSPORT';
window.probe = {
  async authenticate() {
    performance.mark('probe:auth:start');
    app = initializeApp({apiKey:'demo-key',authDomain:'demo-pantheon.firebaseapp.com',projectId:'demo-pantheon',appId:'demo-pantheon'});
    const auth = getAuth(app);
    db = initializeFirestore(app,{useFetchStreams:true});
    connectAuthEmulator(auth,'http://127.0.0.1:9293',{disableWarnings:true});
    connectFirestoreEmulator(db,'127.0.0.1',8193);
    await auth.authStateReady();
    uid = (await signInAnonymously(auth)).user.uid;
    performance.mark('probe:auth:ready');
  },
  async create() {
    room = uid;
    const batch = writeBatch(db);
    batch.set(doc(db,'games',room),{owner:uid,members:[uid],playerCount:2,revision:1,phase:'gathering'});
    batch.set(doc(db,'games',room,'events','1'),{schemaVersion:1,sequence:1,actorUid:uid,type:'game/created',name:'Probe',playerCount:2,createdAt:serverTimestamp()});
    await batch.commit();
  },
  async events() {
    await new Promise((resolve,reject)=>onSnapshot(query(collection(db,'games',room,'events'),orderBy('sequence')),snapshot=>{
      if(!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites && snapshot.size===1)resolve();
    },reject));
  },
  async listen() {
    performance.mark('probe:listen:start');
    const snapshot = await getDocFromServer(doc(db,'games',room));
    if (!snapshot.exists()) throw new Error('Probe document missing');
    performance.mark('probe:listen:ready');
  },
  async transaction() {
    performance.mark('probe:transaction:start');
    const snapshot = await runTransaction(db,async transaction=>{
      const snapshot = await transaction.get(doc(db,'games',room));
      if(room!=='TRANSPORT')await transaction.get(doc(db,'games',room,'events','1'));
      return snapshot;
    });
    if (!snapshot.exists()) throw new Error('Probe transaction document missing');
    performance.mark('probe:transaction:ready');
  },
  async close() { await deleteApp(app); }
};
