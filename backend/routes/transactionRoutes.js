// backend/routes/transactionRoutes.js

const express = require("express");

const {
  getTransactions,
  analyzeTransactions,
  analyzeMultiChainTransactions,
} = require("../controllers/transactionController");

const {
  db,
  adminAuth,
} = require("../firebase");

const router = express.Router();


// ============================================================
// ONLY THIS FIREBASE ACCOUNT CAN EDIT / DELETE
// ============================================================

const INVESTIGATOR_EMAIL =
  "investigator@gmail.com";


// ============================================================
// AUTHENTICATION + INVESTIGATOR AUTHORIZATION
// ============================================================

async function requireInvestigator(
  req,
  res,
  next
) {
  try {

    // --------------------------------------------------------
    // Firebase Admin must be configured
    // --------------------------------------------------------

    if (!adminAuth) {
      return res.status(503).json({
        error:
          "Firebase Admin authentication is not configured.",
      });
    }


    // --------------------------------------------------------
    // Read Authorization header
    // --------------------------------------------------------

    const authHeader =
      req.headers.authorization || "";

    if (
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        error:
          "Authentication required.",
      });
    }


    // --------------------------------------------------------
    // Extract Firebase ID token
    // --------------------------------------------------------

    const idToken =
      authHeader.substring(7);


    // --------------------------------------------------------
    // Verify Firebase token
    // --------------------------------------------------------

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );


    // --------------------------------------------------------
    // Verify email
    // --------------------------------------------------------

    const email =
      String(
        decodedToken.email || ""
      )
        .trim()
        .toLowerCase();


    if (
      email !==
      INVESTIGATOR_EMAIL
    ) {
      return res.status(403).json({
        error:
          "Access denied. Only the investigator account can edit or delete transactions.",
      });
    }


    // --------------------------------------------------------
    // Store verified Firebase user
    // --------------------------------------------------------

    req.user = decodedToken;

    next();

  } catch (error) {

    console.error(
      "Investigator authentication failed:",
      error
    );

    return res.status(401).json({
      error:
        "Invalid or expired Firebase authentication token.",
    });
  }
}


// ============================================================
// READ / ANALYSIS ROUTES
// ============================================================

// ML analysis
router.post(
  "/:address/analyze",
  analyzeTransactions
);


// Multi-chain analysis
router.get(
  "/:address/multi-chain",
  analyzeMultiChainTransactions
);


// Normal transactions
router.get(
  "/:address",
  getTransactions
);


// ============================================================
// UPDATE TRANSACTION
// ============================================================
//
// PUT /api/transactions/:id
//
// ONLY investigator@gmail.com
//

router.put(
  "/:id",
  requireInvestigator,
  async (req, res) => {

    try {

      if (!db) {
        return res.status(503).json({
          error:
            "Firestore is unavailable.",
        });
      }


      const transactionId =
        String(req.params.id || "")
          .trim();


      if (!transactionId) {
        return res.status(400).json({
          error:
            "Transaction ID is required.",
        });
      }


      const {
        hash,
        from,
        to,
        amount,
        currency,
        riskLevel,
        chain,
      } = req.body;


      const transactionRef =
        db
          .collection("transactions")
          .doc(transactionId);


      const transactionSnapshot =
        await transactionRef.get();


      if (
        !transactionSnapshot.exists
      ) {
        return res.status(404).json({
          error:
            "Transaction not found.",
        });
      }


      // ------------------------------------------------------
      // Only update fields supplied by the investigator
      // ------------------------------------------------------

      const updateData = {
        updatedAt: new Date(),
        updatedBy:
          req.user.email,
      };


      if (
        hash !== undefined
      ) {
        updateData.hash = hash;
      }

      if (
        from !== undefined
      ) {
        updateData.from = from;
        updateData.sender = from;
      }

      if (
        to !== undefined
      ) {
        updateData.to = to;
        updateData.receiver = to;
      }

      if (
        amount !== undefined
      ) {
        updateData.amount = amount;
      }

      if (
        currency !== undefined
      ) {
        updateData.currency =
          currency;
      }

      if (
        riskLevel !== undefined
      ) {
        updateData.riskLevel =
          riskLevel;
      }

      if (
        chain !== undefined
      ) {
        updateData.chain =
          chain;
      }


      // ------------------------------------------------------
      // Update Firestore
      // ------------------------------------------------------

      await transactionRef.update(
        updateData
      );


      const updatedSnapshot =
        await transactionRef.get();


      return res.json({
        success: true,
        message:
          "Transaction updated successfully.",
        transaction: {
          id:
            updatedSnapshot.id,
          ...updatedSnapshot.data(),
        },
      });

    } catch (error) {

      console.error(
        "Failed to update transaction:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to update transaction.",
        details:
          error.message,
      });
    }
  }
);


// ============================================================
// DELETE TRANSACTION
// ============================================================
//
// DELETE /api/transactions/:id
//
// ONLY investigator@gmail.com
//

router.delete(
  "/:id",
  requireInvestigator,
  async (req, res) => {

    try {

      if (!db) {
        return res.status(503).json({
          error:
            "Firestore is unavailable.",
        });
      }


      const transactionId =
        String(req.params.id || "")
          .trim();


      if (!transactionId) {
        return res.status(400).json({
          error:
            "Transaction ID is required.",
        });
      }


      const transactionRef =
        db
          .collection("transactions")
          .doc(transactionId);


      const transactionSnapshot =
        await transactionRef.get();


      if (
        !transactionSnapshot.exists
      ) {
        return res.status(404).json({
          error:
            "Transaction not found.",
        });
      }


      // ------------------------------------------------------
      // Delete
      // ------------------------------------------------------

      await transactionRef.delete();


      return res.json({
        success: true,
        message:
          "Transaction deleted successfully.",
        id:
          transactionId,
        deletedBy:
          req.user.email,
      });

    } catch (error) {

      console.error(
        "Failed to delete transaction:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to delete transaction.",
        details:
          error.message,
      });
    }
  }
);


module.exports = router;