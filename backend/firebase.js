// Centralized Firebase Admin setup. Credentials may be supplied as JSON in
// FIREBASE_SERVICE_ACCOUNT_KEY, as a file path in FIREBASE_SERVICE_ACCOUNT_PATH,
// or in the default backend/serviceAccountKey.json file.
const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function loadServiceAccount() {
  const inlineKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  let serviceAccount;

  if (inlineKey) {
    try {
      serviceAccount = JSON.parse(inlineKey);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. Set it to the complete service-account JSON (not a placeholder such as {\"...\"}), or set FIREBASE_SERVICE_ACCOUNT_PATH to a credentials file."
      );
    }
  } else {
    const credentialsPath = configuredPath
      ? path.resolve(process.cwd(), configuredPath)
      : path.join(__dirname, "serviceAccountKey.json");
    try {
      serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    } catch {
      throw new Error(
        `Firebase service-account credentials could not be read from ${credentialsPath}. Set FIREBASE_SERVICE_ACCOUNT_PATH or provide valid JSON in FIREBASE_SERVICE_ACCOUNT_KEY.`
      );
    }
  }

  if (
    !serviceAccount ||
    serviceAccount.type !== "service_account" ||
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      "Firebase service-account credentials are missing required fields (type, project_id, client_email, private_key)."
    );
  }

  return serviceAccount;
}

let db = null;
let configurationError = null;

try {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(loadServiceAccount()) });
  }
  db = getFirestore();
} catch (error) {
  configurationError = error.message;
  console.warn(`Firebase is not configured: ${configurationError}`);
}

module.exports = { db, configurationError };
