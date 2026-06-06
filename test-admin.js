import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

async function testAdmin() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
  const app = initializeApp({
    projectId: config.projectId,
    credential: applicationDefault()
  });
  const db = getFirestore(app, config.firestoreDatabaseId);

  try {
    console.log("Setting doc using admin config...");
    await db.collection('bids').doc('test-admin').set({ hello: 'admin' });
    console.log("Admin Success!");
  } catch (e) {
    console.error("Error code:", e.code);
    console.error("Full error:", e.message);
  }
}
testAdmin();
