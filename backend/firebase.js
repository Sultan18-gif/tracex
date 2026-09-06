// backend/firebase.js
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

// Safely initialize the app without duplicate app errors
if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

// Export the Firestore database instance
const db = getFirestore();

module.exports = { db };