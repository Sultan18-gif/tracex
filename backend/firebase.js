const fs = require("fs");
const path = require("path");

const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");

const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

function loadServiceAccount() {
  const base64Key =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64?.trim();

  console.log(
    "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 exists:",
    Boolean(base64Key)
  );

  if (base64Key) {
    try {
      const json = Buffer
        .from(base64Key, "base64")
        .toString("utf8");

      const serviceAccount = JSON.parse(json);

      console.log(
        "Firebase service account decoded successfully."
      );
      console.log(
        "Firebase project:",
        serviceAccount.project_id
      );

      return serviceAccount;
    } catch (error) {
      console.error(
        "BASE64 FIREBASE KEY ERROR:",
        error.message
      );

      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 could not be decoded."
      );
    }
  }

  const jsonKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

  console.log(
    "FIREBASE_SERVICE_ACCOUNT_KEY exists:",
    Boolean(jsonKey)
  );

  if (jsonKey) {
    try {
      return JSON.parse(jsonKey);
    } catch (error) {
      console.error(
        "FIREBASE JSON KEY ERROR:",
        error.message
      );

      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON."
      );
    }
  }

  throw new Error(
    "NO FIREBASE SERVICE ACCOUNT ENVIRONMENT VARIABLE FOUND."
  );
}

let db = null;
let adminAuth = null;
let configurationError = null;

try {
  const serviceAccount = loadServiceAccount();

  if (!serviceAccount.project_id) {
    throw new Error("Firebase project_id is missing.");
  }

  if (!serviceAccount.client_email) {
    throw new Error("Firebase client_email is missing.");
  }

  if (!serviceAccount.private_key) {
    throw new Error("Firebase private_key is missing.");
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  db = getFirestore();
  adminAuth = getAuth();

  console.log("====================================");
  console.log("FIREBASE ADMIN INITIALIZED SUCCESSFULLY");
  console.log("PROJECT:", serviceAccount.project_id);
  console.log("FIRESTORE: READY");
  console.log("====================================");

} catch (error) {

  configurationError = error.message;

  console.error("====================================");
  console.error("FIREBASE ADMIN INITIALIZATION FAILED");
  console.error("ERROR:", error.message);
  console.error("====================================");

  console.error(
    "BASE64 ENV PRESENT:",
    Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    )
  );

  console.error(
    "JSON ENV PRESENT:",
    Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    )
  );
}

module.exports = {
  db,
  adminAuth,
  configurationError,
};