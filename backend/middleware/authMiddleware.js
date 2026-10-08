const { adminAuth } = require("../firebase");

/**
 * Verify a Firebase ID token.
 *
 * This only verifies that the user is authenticated.
 */
async function requireAuth(req, res, next) {
  try {
    if (!adminAuth) {
      return res.status(503).json({
        error: "Firebase Authentication is unavailable.",
      });
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const idToken = authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        error: "Authentication token is missing.",
      });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    req.user = decodedToken;

    next();
  } catch (error) {
    console.error("Firebase authentication failed:", error);

    return res.status(401).json({
      error: "Invalid or expired authentication token.",
    });
  }
}


/**
 * Verify that the authenticated Firebase user has
 * the editor custom claim.
 */
async function requireEditor(req, res, next) {
  try {
    if (!adminAuth) {
      return res.status(503).json({
        error: "Firebase Authentication is unavailable.",
      });
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    const idToken = authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        error: "Authentication token is missing.",
      });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.role !== "editor") {
      return res.status(403).json({
        error: "Editor permission required.",
      });
    }

    req.user = decodedToken;

    next();
  } catch (error) {
    console.error("Editor authentication failed:", error);

    return res.status(401).json({
      error: "Invalid or expired authentication token.",
    });
  }
}


/**
 * Protect mutations while leaving GET requests available.
 *
 * GET     -> allowed
 * POST    -> editor
 * PUT     -> editor
 * PATCH   -> editor
 * DELETE  -> editor
 */
async function protectMutations(req, res, next) {
  const method = req.method.toUpperCase();

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  return requireEditor(req, res, next);
}


module.exports = {
  requireAuth,
  requireEditor,
  protectMutations,
};