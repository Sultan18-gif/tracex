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

  let serviceAccount = null;

  /*
    OPTION 1
    Base64 encoded service-account JSON
    Recommended for Vercel
  */

  const base64Key =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64?.trim();

  if (base64Key) {
    try {

      const decodedJson = Buffer
        .from(base64Key, "base64")
        .toString("utf8");

      serviceAccount = JSON.parse(decodedJson);

      console.log(
        "Firebase service account loaded from BASE64 environment variable."
      );

    } catch (error) {

      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is invalid. " +
        "Make sure it contains a Base64 encoded Firebase service-account JSON."
      );
    }
  }


  /*
    OPTION 2
    Normal JSON environment variable

    This keeps compatibility with your existing
    FIREBASE_SERVICE_ACCOUNT_KEY.
  */

  else {

    const inlineKey =
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() ||
      process.env.FIREBASE_ADMIN_KEY?.trim();

    if (inlineKey) {

      try {

        serviceAccount = JSON.parse(inlineKey);

        console.log(
          "Firebase service account loaded from JSON environment variable."
        );

      } catch (error) {

        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. " +
          "Set it to the complete Firebase service-account JSON."
        );
      }
    }
  }


  /*
    OPTION 3
    Local serviceAccountKey.json

    Used during local development.
  */

  if (!serviceAccount) {

    const configuredPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();

    const credentialsPath = configuredPath
      ? path.resolve(process.cwd(), configuredPath)
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

      console.log(
        "Firebase service account loaded from local JSON file."
      );

    } catch (error) {

      throw new Error(
        `Firebase service-account credentials could not be read from ${credentialsPath}. ` +
        "Set FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 or " +
        "FIREBASE_SERVICE_ACCOUNT_KEY."
      );
    }
  }


  /* =======================================================
     VALIDATE SERVICE ACCOUNT
  ======================================================= */

  if (
    !serviceAccount ||
    serviceAccount.type !== "service_account" ||
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {

    throw new Error(
      "Firebase service-account credentials are missing required fields: " +
      "type, project_id, client_email, private_key."
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

  const serviceAccount = loadServiceAccount();

  console.log(
    "Firebase project:",
    serviceAccount.project_id
  );

  console.log(
    "Firebase client:",
    serviceAccount.client_email
  );

  if (getApps().length === 0) {

    initializeApp({
      credential: cert(serviceAccount),
    });

  }

  db = getFirestore();

  adminAuth = getAuth();


  console.log(
    "Firebase Admin initialized successfully."
  );

  console.log(
    "Firestore initialized successfully."
  );

} catch (error) {

  configurationError = error.message;

  console.error(
    "========== FIREBASE ADMIN INITIALIZATION FAILED =========="
  );

  console.error(
    "Error name:",
    error.name
  );

  console.error(
    "Error message:",
    error.message
  );

  console.error(
    "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 PRESENT:",
    Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    )
  );

  console.error(
    "FIREBASE_SERVICE_ACCOUNT_KEY PRESENT:",
    Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    )
  );

  console.error(
    "FIREBASE_ADMIN_KEY PRESENT:",
    Boolean(
      process.env.FIREBASE_ADMIN_KEY
    )
  );

  console.error(
    "=========================================================="
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