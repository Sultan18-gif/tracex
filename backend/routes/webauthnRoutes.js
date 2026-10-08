const express = require("express");
const crypto = require("crypto");

const {
  db,
  configurationError,
  FIREBASE_INIT_VERSION,
} = require("../firebase");

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const router = express.Router();


/*
=====================================================
BASIC TEST
=====================================================
*/

router.get("/test", (req, res) => {

  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  res.json({
    message: "WebAuthn route is working",
  });

});


/*
=====================================================
FIREBASE STATUS
=====================================================

TEMPORARY DIAGNOSTIC ENDPOINT

This does NOT expose the Firebase secret.
=====================================================
*/

router.get("/firebase-status", (req, res) => {

  /*
  Disable all caching.
  */

  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  res.set(
    "Pragma",
    "no-cache"
  );

  res.set(
    "Expires",
    "0"
  );


  res.status(200).json({

    timestamp:
      new Date().toISOString(),

    firebaseInitVersion:
      FIREBASE_INIT_VERSION || null,

    firestoreAvailable:
      Boolean(db),

    dbType:
      typeof db,

    firebaseServiceAccountBase64Present:
      Boolean(
        process.env
          .FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
      ),

    firebaseServiceAccountJsonPresent:
      Boolean(
        process.env
          .FIREBASE_SERVICE_ACCOUNT_KEY
      ),

    firebaseAdminKeyPresent:
      Boolean(
        process.env
          .FIREBASE_ADMIN_KEY
      ),

    configurationError:
      configurationError || null,

  });

});


const rpName = "TraceX";


/*
=====================================================
WEB AUTHN CONTEXT
=====================================================
*/

function getWebAuthnContext(req) {

  const forwardedHost =
    req.get("x-forwarded-host") ||
    req.get("host");


  const forwardedProto =
    req.get("x-forwarded-proto") ||
    req.protocol;


  const refererOrigin =
    req.get("referer")
      ? new URL(
          req.get("referer")
        ).origin
      : null;


  const configuredOrigin =
    req.get("origin") ||
    refererOrigin ||
    process.env.PUBLIC_APP_URL ||
    (
      forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : "http://localhost:5173"
    );


  const origin =
    new URL(
      configuredOrigin
    ).origin;


  return {

    origin,

    rpID:
      process.env.WEBAUTHN_RP_ID ||
      new URL(origin).hostname,

  };

}


/*
=====================================================
FIRESTORE COLLECTION
=====================================================
*/

const usersCollection = () => {

  if (!db) {

    const error =
      new Error(
        configurationError ||
        "Firestore is unavailable. Firebase Admin initialization failed."
      );


    error.statusCode = 503;

    throw error;
  }


  return db.collection(
    "webauthn_users"
  );

};


/*
=====================================================
USER DOCUMENT ID
=====================================================
*/

const getUserDocumentId =
  (email) =>

    crypto
      .createHash("sha256")
      .update(
        email
          .trim()
          .toLowerCase()
      )
      .digest("hex");


/*
=====================================================
LOAD USER
=====================================================
*/

async function loadUser(
  email,
  create = false
) {

  const normalizedEmail =
    email
      .trim()
      .toLowerCase();


  const reference =
    usersCollection()
      .doc(
        getUserDocumentId(
          normalizedEmail
        )
      );


  const snapshot =
    await reference.get();


  if (snapshot.exists) {

    return {

      reference,

      user:
        snapshot.data(),

    };

  }


  if (!create) {

    return {

      reference,

      user: null,

    };

  }


  const user = {

    email:
      normalizedEmail,

    userId:
      crypto
        .randomBytes(32)
        .toString("base64url"),

    passkeys: [],

  };


  await reference.set(
    user
  );


  return {

    reference,

    user,

  };

}


/*
=====================================================
ERROR HANDLER
=====================================================
*/

function sendWebAuthnError(
  res,
  error,
  fallbackMessage,
  fallbackStatus = 500
) {

  console.error(
    fallbackMessage,
    error
  );


  res
    .status(
      error.statusCode ||
      fallbackStatus
    )
    .json({

      error:
        error.statusCode === 503
          ? error.message
          : fallbackMessage,

    });

}


/*
=====================================================
FIRESTORE SAFE OPTIONS
=====================================================
*/

function makeFirestoreSafeOptions(
  options
) {

  return JSON.parse(
    JSON.stringify(options)
  );

}


/*
=====================================================
REGISTRATION OPTIONS
=====================================================
*/

router.post(
  "/register/options",
  async (req, res) => {

    try {

      const {
        rpID,
      } =
        getWebAuthnContext(req);


      const {
        email,
      } =
        req.body;


      if (!email) {

        return res
          .status(400)
          .json({

            error:
              "Email is required",

          });

      }


      const {
        reference,
        user,
      } =
        await loadUser(
          email,
          true
        );


      const options =
        await generateRegistrationOptions({

          rpName,

          rpID,

          userID:
            Buffer.from(
              user.userId,
              "base64url"
            ),

          userName:
            email,

          attestationType:
            "none",

          excludeCredentials:
            (user.passkeys || [])
              .map(
                (passkey) => ({

                  id:
                    passkey.id,

                  transports:
                    passkey.transports,

                })
              ),

          authenticatorSelection: {

            residentKey:
              "required",

            userVerification:
              "required",

            authenticatorAttachment:
              "platform",

          },

        });


      await reference.set(

        {

          currentRegistrationOptions:
            makeFirestoreSafeOptions(
              options
            ),

        },

        {

          merge: true,

        }

      );


      res.json(
        options
      );


    } catch (error) {

      sendWebAuthnError(

        res,

        error,

        "Unable to create registration options"

      );

    }

  }
);


/*
=====================================================
REGISTRATION VERIFICATION
=====================================================
*/

router.post(
  "/register/verify",
  async (req, res) => {

    try {

      const {
        origin,
        rpID,
      } =
        getWebAuthnContext(req);


      const {
        email,
        response,
      } =
        req.body;


      if (!email || !response) {

        return res
          .status(400)
          .json({

            error:
              "Email and WebAuthn response are required",

          });

      }


      const {
        reference,
        user,
      } =
        await loadUser(
          email
        );


      if (
        !user ||
        !user.currentRegistrationOptions
      ) {

        return res
          .status(400)
          .json({

            error:
              "Registration session not found",

          });

      }


      const verification =
        await verifyRegistrationResponse({

          response,

          expectedChallenge:
            user
              .currentRegistrationOptions
              .challenge,

          expectedOrigin:
            origin,

          expectedRPID:
            rpID,

          requireUserVerification:
            true,

        });


      if (!verification.verified) {

        return res
          .status(400)
          .json({

            verified: false,

            error:
              "Windows Hello registration failed",

          });

      }


      const {
        credential,
        credentialDeviceType,
        credentialBackedUp,
      } =
        verification.registrationInfo;


      const passkey = {

        id:
          credential.id,

        publicKey:
          Buffer
            .from(
              credential.publicKey
            )
            .toString("base64"),

        counter:
          credential.counter,

        transports:
          response
            .response
            ?.transports || [],

        deviceType:
          credentialDeviceType,

        backedUp:
          credentialBackedUp,

      };


      await reference.set(

        {

          passkeys: [

            ...(user.passkeys || []),

            passkey,

          ],

          currentRegistrationOptions:
            null,

        },

        {

          merge: true,

        }

      );


      res.json({

        verified: true,

        message:
          "Windows Hello registered successfully",

      });


    } catch (error) {

      sendWebAuthnError(

        res,

        error,

        error.message ||
          "Windows Hello registration failed",

        400

      );

    }

  }
);


/*
=====================================================
AUTHENTICATION OPTIONS
=====================================================
*/

router.post(
  "/login/options",
  async (req, res) => {

    try {

      const {
        rpID,
      } =
        getWebAuthnContext(req);


      const {
        email,
      } =
        req.body;


      if (!email) {

        return res
          .status(400)
          .json({

            error:
              "Email is required",

          });

      }


      const {
        reference,
        user,
      } =
        await loadUser(
          email
        );


      if (
        !user ||
        (user.passkeys || [])
          .length === 0
      ) {

        return res
          .status(404)
          .json({

            error:
              "No Windows Hello credential registered",

          });

      }


      const options =
        await generateAuthenticationOptions({

          rpID,

          allowCredentials:
            (user.passkeys || [])
              .map(
                (passkey) => ({

                  id:
                    passkey.id,

                  transports:
                    passkey.transports,

                })
              ),

          userVerification:
            "required",

        });


      await reference.set(

        {

          currentAuthenticationOptions:
            makeFirestoreSafeOptions(
              options
            ),

        },

        {

          merge: true,

        }

      );


      res.json(
        options
      );


    } catch (error) {

      sendWebAuthnError(

        res,

        error,

        "Unable to create authentication options"

      );

    }

  }
);


/*
=====================================================
AUTHENTICATION VERIFICATION
=====================================================
*/

router.post(
  "/login/verify",
  async (req, res) => {

    try {

      const {
        origin,
        rpID,
      } =
        getWebAuthnContext(req);


      const {
        email,
        response,
      } =
        req.body;


      if (!email || !response) {

        return res
          .status(400)
          .json({

            error:
              "Email and WebAuthn response are required",

          });

      }


      const {
        reference,
        user,
      } =
        await loadUser(
          email
        );


      if (
        !user ||
        !user.currentAuthenticationOptions
      ) {

        return res
          .status(400)
          .json({

            error:
              "Authentication session not found",

          });

      }


      const passkey =
        (user.passkeys || [])
          .find(
            (item) =>
              item.id === response.id
          );


      if (!passkey) {

        return res
          .status(400)
          .json({

            error:
              "Windows Hello credential not found",

          });

      }


      const verification =
        await verifyAuthenticationResponse({

          response,

          expectedChallenge:
            user
              .currentAuthenticationOptions
              .challenge,

          expectedOrigin:
            origin,

          expectedRPID:
            rpID,

          credential: {

            id:
              passkey.id,

            publicKey:
              Buffer.from(
                passkey.publicKey,
                "base64"
              ),

            counter:
              passkey.counter,

            transports:
              passkey.transports,

          },

          requireUserVerification:
            true,

        });


      if (!verification.verified) {

        return res
          .status(401)
          .json({

            verified: false,

            error:
              "Windows Hello authentication failed",

          });

      }


      const updatedPasskeys =
        (user.passkeys || [])
          .map(
            (savedPasskey) =>

              savedPasskey.id ===
              passkey.id

                ? {

                    ...savedPasskey,

                    counter:
                      verification
                        .authenticationInfo
                        .newCounter,

                  }

                : savedPasskey
          );


      await reference.set(

        {

          passkeys:
            updatedPasskeys,

          currentAuthenticationOptions:
            null,

        },

        {

          merge: true,

        }

      );


      res.json({

        verified: true,

        message:
          "Windows Hello authentication successful",

      });


    } catch (error) {

      sendWebAuthnError(

        res,

        error,

        error.message ||
          "Windows Hello authentication failed",

        401

      );

    }

  }
);


module.exports = router;