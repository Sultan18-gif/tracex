const express = require("express");
const crypto = require("crypto");

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const router = express.Router();
router.get("/test", (req, res) => {
  res.json({
    message: "WebAuthn route is working"
  });
});

const rpName = "TraceX";

function getWebAuthnContext(req) {
  const configuredOrigin = process.env.PUBLIC_APP_URL || req.get("origin") || "http://localhost:5173";
  const origin = new URL(configuredOrigin).origin;
  return {
    origin,
    rpID: process.env.WEBAUTHN_RP_ID || new URL(origin).hostname,
  };
}

// Temporary storage for testing
const users = new Map();

/*
  Registration
  -----------------------------------------
  Generate Windows Hello registration options
*/
router.post("/register/options", async (req, res) => {
  try {
    const { rpID } = getWebAuthnContext(req);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    let user = users.get(email);

    if (!user) {
      user = {
        email,
        id: crypto.randomBytes(32),
        passkeys: [],
      };

      users.set(email, user);
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,

      userName: email,

      attestationType: "none",

      excludeCredentials: user.passkeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports,
      })),

      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });

    user.currentRegistrationOptions = options;

    res.json(options);
  } catch (error) {
    console.error("WebAuthn registration options error:", error);

    res.status(500).json({
      error: "Unable to create registration options",
    });
  }
});


/*
  Registration verification
  -----------------------------------------
  Verify Windows Hello registration
*/
router.post("/register/verify", async (req, res) => {
  try {
    const { origin, rpID } = getWebAuthnContext(req);
    const { email, response } = req.body;

    if (!email || !response) {
      return res.status(400).json({
        error: "Email and WebAuthn response are required",
      });
    }

    const user = users.get(email);

    if (!user || !user.currentRegistrationOptions) {
      return res.status(400).json({
        error: "Registration session not found",
      });
    }

    const verification = await verifyRegistrationResponse({
      response,

      expectedChallenge:
        user.currentRegistrationOptions.challenge,

      expectedOrigin: origin,
      expectedRPID: rpID,

      requireUserVerification: true,
    });

    if (!verification.verified) {
      return res.status(400).json({
        verified: false,
        error: "Windows Hello registration failed",
      });
    }

    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    user.passkeys.push({
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: response.response?.transports || [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });

    delete user.currentRegistrationOptions;

    res.json({
      verified: true,
      message: "Windows Hello registered successfully",
    });
  } catch (error) {
    console.error("WebAuthn registration verification error:", error);

    res.status(400).json({
      verified: false,
      error: error.message,
    });
  }
});


/*
  Authentication
  -----------------------------------------
  Generate Windows Hello login options
*/
router.post("/login/options", async (req, res) => {
  try {
    const { rpID } = getWebAuthnContext(req);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const user = users.get(email);

    if (!user || user.passkeys.length === 0) {
      return res.status(404).json({
        error: "No Windows Hello credential registered",
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,

      allowCredentials: user.passkeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports,
      })),

      userVerification: "required",
    });

    user.currentAuthenticationOptions = options;

    res.json(options);
  } catch (error) {
    console.error("WebAuthn login options error:", error);

    res.status(500).json({
      error: "Unable to create authentication options",
    });
  }
});


/*
  Authentication verification
  -----------------------------------------
  Verify Windows Hello login
*/
router.post("/login/verify", async (req, res) => {
  try {
    const { origin, rpID } = getWebAuthnContext(req);
    const { email, response } = req.body;

    if (!email || !response) {
      return res.status(400).json({
        error: "Email and WebAuthn response are required",
      });
    }

    const user = users.get(email);

    if (!user || !user.currentAuthenticationOptions) {
      return res.status(400).json({
        error: "Authentication session not found",
      });
    }

    const passkey = user.passkeys.find(
      (item) => item.id === response.id
    );

    if (!passkey) {
      return res.status(400).json({
        error: "Windows Hello credential not found",
      });
    }

    const verification = await verifyAuthenticationResponse({
      response,

      expectedChallenge:
        user.currentAuthenticationOptions.challenge,

      expectedOrigin: origin,
      expectedRPID: rpID,

      credential: {
        id: passkey.id,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports,
      },

      requireUserVerification: true,
    });

    if (!verification.verified) {
      return res.status(401).json({
        verified: false,
        error: "Windows Hello authentication failed",
      });
    }

    passkey.counter = verification.authenticationInfo.newCounter;

    delete user.currentAuthenticationOptions;

    res.json({
      verified: true,
      message: "Windows Hello authentication successful",
    });
  } catch (error) {
    console.error("WebAuthn authentication verification error:", error);

    res.status(401).json({
      verified: false,
      error: error.message,
    });
  }
});


module.exports = router;
