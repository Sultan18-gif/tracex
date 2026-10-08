const {
  initializeApp,
  cert,
  getApps,
  getApp,
} = require("firebase-admin/app");

const {
  getFirestore,
} = require("firebase-admin/firestore");

const {
  getAuth,
} = require("firebase-admin/auth");

function getServiceAccount() {
  const base64Key =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64?.trim();

  const jsonKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

  let serviceAccount;

  // 1. Prefer Base64
  if (base64Key) {
    try {
      const decoded = Buffer
        .from(base64Key, "base64")
        .toString("utf8");

      serviceAccount = JSON.parse(decoded);

      console.log(
        "Firebase credentials loaded from BASE64."
      );
    } catch (error) {
      throw new Error(
        "Firebase Base64 credentials are invalid: " +
        error.message
      );
    }
  }

  // 2. Fallback to normal JSON
  else if (jsonKey) {
    try {
      serviceAccount = JSON.parse(jsonKey);

      console.log(
        "Firebase credentials loaded from JSON."
      );
    } catch (error) {
      throw new Error(
        "Firebase JSON credentials are invalid: " +
        error.message
      );
    }
  }

  else {
    throw new Error(
      "No Firebase service account credentials found."
    );
  }

  // Validate credentials
  if (!serviceAccount.project_id) {
    throw new Error(
      "Firebase credentials missing project_id."
    );
  }

  if (!serviceAccount.client_email) {
    throw new Error(
      "Firebase credentials missing client_email."
    );
  }

  if (!serviceAccount.private_key) {
    throw new Error(
      "Firebase credentials missing private_key."
    );
  }

  return serviceAccount;
}


let db = null;
let adminAuth = null;
let configurationError = null;

try {

  const serviceAccount = getServiceAccount();

  console.log(
    "Firebase project:",
    serviceAccount.project_id
  );

  console.log(
    "Firebase client:",
    serviceAccount.client_email
  );

  /*
   * Reuse existing Firebase Admin app
   * if one already exists.
   */
  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert(serviceAccount),
        });

  /*
   * IMPORTANT:
   * Get Firestore from the initialized app.
   */
  db = getFirestore(app);

  adminAuth = getAuth(app);

  console.log(
    "=========================================="
  );

  console.log(
    "FIREBASE ADMIN INITIALIZED SUCCESSFULLY"
  );

  console.log(
    "PROJECT:",
    serviceAccount.project_id
  );

  console.log(
    "FIRESTORE:",
    Boolean(db)
  );

  console.log(
    "AUTH:",
    Boolean(adminAuth)
  );

  console.log(
    "=========================================="
  );

} catch (error) {

  configurationError =
    error?.stack ||
    error?.message ||
    String(error);

  console.error(
    "=========================================="
  );

  console.error(
    "FIREBASE ADMIN INITIALIZATION FAILED"
  );

  console.error(
    configurationError
  );

  console.error(
    "=========================================="
  );
}


module.exports = {
  db,
  adminAuth,
  configurationError,
};