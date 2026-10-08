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

const FIREBASE_INIT_VERSION =
  "TRACEX-FIREBASE-FIX-2026-10-09-V3";

let db = null;
let adminAuth = null;
let configurationError = null;


/*
=====================================================
LOAD FIREBASE SERVICE ACCOUNT
=====================================================
*/

function loadServiceAccount() {

  const base64Key =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64?.trim();

  const jsonKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();


  /*
  ---------------------------------------------------
  OPTION 1: BASE64
  ---------------------------------------------------
  */

  if (base64Key) {

    console.log(
      "FIREBASE: BASE64 environment variable detected."
    );

    try {

      const decodedJson =
        Buffer
          .from(base64Key, "base64")
          .toString("utf8");

      const serviceAccount =
        JSON.parse(decodedJson);


      console.log(
        "FIREBASE: BASE64 credentials decoded successfully."
      );

      console.log(
        "FIREBASE: Project:",
        serviceAccount.project_id
      );


      return serviceAccount;

    } catch (error) {

      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 is invalid: " +
        error.message
      );
    }
  }


  /*
  ---------------------------------------------------
  OPTION 2: NORMAL JSON
  ---------------------------------------------------
  */

  if (jsonKey) {

    console.log(
      "FIREBASE: JSON environment variable detected."
    );

    try {

      const serviceAccount =
        JSON.parse(jsonKey);


      console.log(
        "FIREBASE: JSON credentials parsed successfully."
      );

      console.log(
        "FIREBASE: Project:",
        serviceAccount.project_id
      );


      return serviceAccount;

    } catch (error) {

      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is invalid JSON: " +
        error.message
      );
    }
  }


  /*
  ---------------------------------------------------
  NO CREDENTIALS
  ---------------------------------------------------
  */

  throw new Error(
    "No Firebase service-account credentials found. " +
    "Configure FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 " +
    "or FIREBASE_SERVICE_ACCOUNT_KEY."
  );
}


/*
=====================================================
VALIDATE SERVICE ACCOUNT
=====================================================
*/

function validateServiceAccount(
  serviceAccount
) {

  if (!serviceAccount) {
    throw new Error(
      "Firebase service account is empty."
    );
  }


  if (
    serviceAccount.type !==
    "service_account"
  ) {

    throw new Error(
      "Firebase service account has invalid type."
    );
  }


  if (!serviceAccount.project_id) {

    throw new Error(
      "Firebase service account is missing project_id."
    );
  }


  if (!serviceAccount.client_email) {

    throw new Error(
      "Firebase service account is missing client_email."
    );
  }


  if (!serviceAccount.private_key) {

    throw new Error(
      "Firebase service account is missing private_key."
    );
  }


  return true;
}


/*
=====================================================
INITIALIZE FIREBASE ADMIN
=====================================================
*/

try {

  console.log(
    "=============================================="
  );

  console.log(
    "TRACE X FIREBASE INITIALIZATION"
  );

  console.log(
    "VERSION:",
    FIREBASE_INIT_VERSION
  );

  console.log(
    "BASE64 ENV PRESENT:",
    Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    )
  );

  console.log(
    "JSON ENV PRESENT:",
    Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    )
  );

  console.log(
    "=============================================="
  );


  /*
  Load credentials
  */

  const serviceAccount =
    loadServiceAccount();


  /*
  Validate credentials
  */

  validateServiceAccount(
    serviceAccount
  );


  console.log(
    "FIREBASE: Credentials validated."
  );

  console.log(
    "FIREBASE PROJECT:",
    serviceAccount.project_id
  );

  console.log(
    "FIREBASE CLIENT:",
    serviceAccount.client_email
  );


  /*
  Create/reuse Firebase Admin app
  */

  let app;

  if (getApps().length === 0) {

    console.log(
      "FIREBASE: Creating Admin app..."
    );

    app = initializeApp({
      credential:
        cert(serviceAccount),
    });

  } else {

    console.log(
      "FIREBASE: Existing Admin app found."
    );

    app = getApp();
  }


  console.log(
    "FIREBASE: Admin app initialized:",
    app.name
  );


  /*
  Initialize Firestore
  */

  db = getFirestore(app);


  console.log(
    "FIREBASE: Firestore object created."
  );


  /*
  Initialize Firebase Admin Auth
  */

  adminAuth =
    getAuth(app);


  console.log(
    "FIREBASE: Admin Auth initialized."
  );


  /*
  SUCCESS
  */

  console.log(
    "=============================================="
  );

  console.log(
    "FIREBASE ADMIN INITIALIZATION SUCCESS"
  );

  console.log(
    "PROJECT:",
    serviceAccount.project_id
  );

  console.log(
    "FIRESTORE READY:",
    Boolean(db)
  );

  console.log(
    "AUTH READY:",
    Boolean(adminAuth)
  );

  console.log(
    "VERSION:",
    FIREBASE_INIT_VERSION
  );

  console.log(
    "=============================================="
  );


} catch (error) {

  configurationError =
    error?.stack ||
    error?.message ||
    String(error);


  console.error(
    "=============================================="
  );

  console.error(
    "FIREBASE ADMIN INITIALIZATION FAILED"
  );

  console.error(
    configurationError
  );

  console.error(
    "=============================================="
  );

}


/*
=====================================================
EXPORT
=====================================================
*/

module.exports = {

  db,

  adminAuth,

  configurationError,

  FIREBASE_INIT_VERSION,

};