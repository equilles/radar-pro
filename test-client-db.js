import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

async function test() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
  const app = initializeApp(config);
  const db = getFirestore(app, config.firestoreDatabaseId);

  try {
    console.log("Setting doc in db:", config.firestoreDatabaseId);
    await setDoc(doc(db, 'bids', 'test1234'), { hello: 'world' });
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
