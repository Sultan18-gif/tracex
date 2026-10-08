const express = require("express");

const router = express.Router();

const {
  getVASPs,
  getVASP,
  createVASP,
  updateVASP,
  deleteVASP,
} = require("../controllers/vaspController");

const { adminAuth } = require("../firebase");

// ============================================================
// ONLY investigator@gmail.com can modify VASPs
// ============================================================
const INVESTIGATOR_EMAIL = "investigator@gmail.com";

async function requireInvestigator(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    // --------------------------------------------------------
    // Authorization header required
    // --------------------------------------------------------
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const idToken = authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        message: "Authentication token is missing.",
      });
    }

    // --------------------------------------------------------
    // Verify Firebase ID token
    // --------------------------------------------------------
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const email = String(decodedToken.email || "")
      .trim()
      .toLowerCase();

    // --------------------------------------------------------
    // Only investigator@gmail.com gets write access
    // --------------------------------------------------------
    if (email !== INVESTIGATOR_EMAIL) {
      return res.status(403).json({
        message:
          "Access denied. Only the investigator account can modify VASPs.",
      });
    }

    // Store authenticated user information for later use.
    req.user = decodedToken;

    next();
  } catch (error) {
    console.error("VASP authentication failed:", error);

    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}

// ============================================================
// READ — All authenticated users can view VASPs
// ============================================================
router.get("/", getVASPs);

router.get("/:vaspId", getVASP);

// ============================================================
// WRITE — Only investigator@gmail.com
// ============================================================
router.post("/", requireInvestigator, createVASP);

router.put("/:vaspId", requireInvestigator, updateVASP);

router.delete("/:vaspId", requireInvestigator, deleteVASP);

module.exports = router;