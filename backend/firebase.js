const fs = require("fs");
const path = require("path");

const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");

const {
  getFirestore,
} = require("firebase-admin/firestore");

const {
  getAuth,
} = require("firebase-admin/auth");

/* =========================================================
   LOAD FIREBASE SERVICE ACCOUNT
========================================================= */

function loadServiceAccount() {
  const inlineKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

  const configuredPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

  let serviceAccount;

  /* -------------------------------------------------------
     Option 1: Service account JSON from environment variable
  ------------------------------------------------------- */

  if (inlineKey) {
    try {
      serviceAccount = JSON.parse(inlineKey);
    } catch (error) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. " +
          "Set it to the complete service-account JSON " +
          "or use FIREBASE_SERVICE_ACCOUNT_PATH."
      );
    }
  }

  /* -------------------------------------------------------
     Option 2: Service account JSON file
  ------------------------------------------------------- */

  else {
    const credentialsPath = configuredPath
      ? path.resolve(
          process.cwd(),
          configuredPath
        )
      : path.join(
          __dirname,
          "serviceAccountKey.json"
        );

    try {
      serviceAccount = JSON.parse(
        fs.readFileSync(
          credentialsPath,
          "utf8"
        )
      );
    } catch (error) {
      throw new Error(
        `Firebase service-account credentials could not be read from ${credentialsPath}. ` +
          "Set FIREBASE_SERVICE_ACCOUNT_PATH or provide valid JSON in FIREBASE_SERVICE_ACCOUNT_KEY."
      );
    }
  }

  /* -------------------------------------------------------
     Validate service account
  ------------------------------------------------------- */

  if (
    !serviceAccount ||
    serviceAccount.type !== "service_account" ||
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      "Firebase service-account credentials are missing required fields " +
        "(type, project_id, client_email, private_key)."
    );
  }

  return serviceAccount;
}

/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

let db = null;
let adminAuth = null;
let configurationError = null;

try {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(
        loadServiceAccount()
      ),
    });
  }

  db = getFirestore();
  adminAuth = getAuth();

  console.log(
    "Firebase Admin initialized successfully."
  );
} catch (error) {
  configurationError =
    error.message;

  console.warn(
    `Firebase is not configured: ${configurationError}`
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  db,
  adminAuth,
  configurationError,
};