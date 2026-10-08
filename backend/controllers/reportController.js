const crypto = require("crypto");

const {
  db,
  adminAuth,
} = require("../firebase");

/* =========================================================
   HELPERS
========================================================= */

function createReportId() {
  const timestamp =
    new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14);

  const random =
    crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase();

  return `TRX-FR-${timestamp}-${random}`;
}

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  try {
    if (
      typeof value.toDate ===
      "function"
    ) {
      return value
        .toDate()
        .toISOString();
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date.toISOString();
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const authorization =
    req.headers.authorization ||
    "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  return authorization.substring(7);
}

/* =========================================================
   GET CURRENT USER
========================================================= */

async function getAuthenticatedUser(req) {
  /*
    Reports can only record the real Firebase user
    when the frontend sends:

    Authorization: Bearer <Firebase ID token>
  */

  const token =
    getBearerToken(req);

  if (!token || !adminAuth) {
    return null;
  }

  try {
    return await adminAuth.verifyIdToken(
      token
    );
  } catch (error) {
    console.warn(
      "Unable to verify Firebase report token:",
      error.message
    );

    return null;
  }
}

/* =========================================================
   GENERATE REPORT
========================================================= */

const generateReport = async (
  req,
  res
) => {
  try {
    if (!db) {
      return res.status(503).json({
        message:
          "Firestore is unavailable.",
      });
    }

    const {
      caseId,
    } = req.body;

    if (!caseId) {
      return res.status(400).json({
        message:
          "A case ID is required.",
      });
    }

    /*
      -------------------------------------------------------
      GET CASE
      -------------------------------------------------------
    */

    let caseSnapshot =
      await db
        .collection("cases")
        .doc(caseId)
        .get();

    /*
      Some existing cases may use caseId as a
      field rather than the Firestore document ID.
    */

    if (!caseSnapshot.exists) {
      const querySnapshot =
        await db
          .collection("cases")
          .where(
            "caseId",
            "==",
            caseId
          )
          .limit(1)
          .get();

      if (
        !querySnapshot.empty
      ) {
        caseSnapshot =
          querySnapshot.docs[0];
      }
    }

    if (!caseSnapshot.exists) {
      return res.status(404).json({
        message:
          "Investigation case not found.",
      });
    }

    const caseData =
      caseSnapshot.data();

    /*
      -------------------------------------------------------
      AUTHENTICATED USER
      -------------------------------------------------------
    */

    const firebaseUser =
      await getAuthenticatedUser(
        req
      );

    const generatedBy = {
      email:
        firebaseUser?.email ||
        "unknown",

      uid:
        firebaseUser?.uid ||
        null,

      role:
        firebaseUser?.role ||
        "viewer",
    };

    /*
      -------------------------------------------------------
      WALLET
      -------------------------------------------------------
    */

    const walletAddress =
      caseData.walletAddress ||
      (
        Array.isArray(
          caseData.wallets
        )
          ? caseData.wallets[0]
              ?.address ||
            caseData.wallets[0] ||
            ""
          : ""
      );

    /*
      -------------------------------------------------------
      TRANSACTIONS
      -------------------------------------------------------
    */

    const transactions =
      Array.isArray(
        caseData.transactions
      )
        ? caseData.transactions
        : [];

    const totalTransactions =
      transactions.length;

    const suspiciousTransactions =
      transactions.filter(
        (transaction) => {
          const risk =
            String(
              transaction.riskLevel ||
                transaction.risk ||
                ""
            ).toLowerCase();

          return (
            risk === "high" ||
            risk === "critical" ||
            risk === "suspicious"
          );
        }
      );

    const highRiskTransactions =
      transactions.filter(
        (transaction) =>
          ["high", "critical"].includes(
            String(
              transaction.riskLevel ||
                transaction.risk ||
                ""
            ).toLowerCase()
          )
      );

    const mediumRiskTransactions =
      transactions.filter(
        (transaction) =>
          String(
            transaction.riskLevel ||
              transaction.risk ||
              ""
          ).toLowerCase() ===
          "medium"
      );

    const lowRiskTransactions =
      transactions.filter(
        (transaction) =>
          String(
            transaction.riskLevel ||
              transaction.risk ||
              ""
          ).toLowerCase() ===
          "low"
      );

    /*
      -------------------------------------------------------
      REPORT ID
      -------------------------------------------------------
    */

    const reportId =
      createReportId();

    const generatedAt =
      new Date().toISOString();

    /*
      -------------------------------------------------------
      RISK
      -------------------------------------------------------
    */

    const riskScore =
      caseData.riskScore ??
      caseData.risk?.score ??
      null;

    const riskLevel =
      caseData.riskLevel ||
      (
        typeof caseData.riskScore ===
        "string"
          ? caseData.riskScore
          : "UNKNOWN"
      );

    /*
      -------------------------------------------------------
      FINDINGS
      -------------------------------------------------------
    */

    const findings =
      Array.isArray(
        caseData.findings
      )
        ? caseData.findings
        : [];

    /*
      -------------------------------------------------------
      FORENSIC JSON
      -------------------------------------------------------
    */

    const report = {
      reportId,

      caseId:
        caseData.caseId ||
        caseId,

      reportType:
        "Cryptocurrency Forensic Investigation",

      status:
        "FINAL",

      generatedBy,

      generatedAt,

      subject: {
        walletAddress:
          walletAddress ||
          null,

        blockchain:
          caseData.blockchain ||
          caseData.chain ||
          "Unknown",
      },

      caseInformation: {
        title:
          caseData.title ||
          "Fraud Investigation",

        description:
          caseData.description ||
          "",

        status:
          caseData.status ||
          "Open",

        priority:
          caseData.priority ||
          null,

        opened:
          normalizeTimestamp(
            caseData.createdAt
          ),

        updated:
          normalizeTimestamp(
            caseData.updatedAt
          ),
      },

      riskAssessment: {
        riskScore,

        riskLevel,

        fraudProbability:
          caseData.fraudProbability ??
          caseData.risk?.fraudProbability ??
          null,

        anomalyScore:
          caseData.anomalyScore ??
          caseData.risk?.anomalyScore ??
          null,

        modelConfidence:
          caseData.modelConfidence ??
          caseData.risk?.modelConfidence ??
          null,
      },

      transactionAnalysis: {
        totalTransactions,

        suspiciousTransactions:
          suspiciousTransactions.length,

        highRiskTransactions:
          highRiskTransactions.length,

        mediumRiskTransactions:
          mediumRiskTransactions.length,

        lowRiskTransactions:
          lowRiskTransactions.length,
      },

      transactions,

      networkAnalysis: {
        connectedWallets:
          Array.isArray(
            caseData.connectedWallets
          )
            ? caseData
                .connectedWallets.length
            : caseData.connectedWallets ??
              0,

        directCounterparties:
          caseData.directCounterparties ??
          0,

        indirectCounterparties:
          caseData.indirectCounterparties ??
          0,

        highRiskNodes:
          caseData.highRiskNodes ??
          0,

        vaspNodes:
          caseData.vaspNodes ??
          0,

        nodes:
          Array.isArray(
            caseData.networkNodes
          )
            ? caseData.networkNodes
            : [],

        edges:
          Array.isArray(
            caseData.networkEdges
          )
            ? caseData.networkEdges
            : [],
      },

      vaspAnalysis:
        Array.isArray(
          caseData.vaspAnalysis
        )
          ? caseData.vaspAnalysis
          : [],

      behavioralAnalysis:
        caseData.behavioralAnalysis ||
        {},

      mlAnalysis:
        caseData.mlAnalysis ||
        {},

      evidence:
        Array.isArray(
          caseData.evidence
        )
          ? caseData.evidence
          : [],

      timeline:
        Array.isArray(
          caseData.timeline
        )
          ? caseData.timeline
          : [],

      findings,

      conclusion: {
        overallAssessment:
          riskLevel,

        summary:
          caseData.conclusion ||
          "The investigated wallet requires forensic review based on the available investigation data.",

        recommendedActions:
          Array.isArray(
            caseData.recommendedActions
          )
            ? caseData.recommendedActions
            : [
                "Continue wallet monitoring",
                "Investigate connected wallets",
                "Review high-risk transactions",
                "Preserve transaction evidence",
              ],
      },

      integrity: {
        reportVersion:
          "1.0",

        dataSources: [
          "TraceX Investigation Database",
          "Blockchain Transaction Data",
          "VASP Analysis",
          "Risk Analysis Engine",
        ],

        integrityStatus:
          "VERIFIED",
      },
    };

    /*
      -------------------------------------------------------
      STORE REPORT
      -------------------------------------------------------
    */

    await db
      .collection("forensicReports")
      .doc(reportId)
      .set({
        ...report,

        /*
          Useful Firestore indexing fields.
        */

        generatedByEmail:
          generatedBy.email,

        generatedByUid:
          generatedBy.uid,

        createdAt:
          generatedAt,

        updatedAt:
          generatedAt,
      });

    return res.status(201).json({
      message:
        "Forensic investigation report generated successfully.",

      reportStatus:
        "Generated",

      reportId,

      caseId:
        report.caseId,

      generatedBy,

      generatedAt,

      report,
    });
  } catch (error) {
    console.error(
      "Unable to generate forensic report:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to generate forensic report.",

      error:
        error.message ||
        "Unknown error",
    });
  }
};

/* =========================================================
   GET ALL REPORTS
========================================================= */

const getReports = async (
  req,
  res
) => {
  try {
    if (!db) {
      return res.status(503).json({
        message:
          "Firestore is unavailable.",
      });
    }

    const snapshot =
      await db
        .collection("forensicReports")
        .orderBy(
          "createdAt",
          "desc"
        )
        .get();

    const reports =
      snapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
        })
      );

    return res.json(
      reports
    );
  } catch (error) {
    console.error(
      "Unable to load forensic reports:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load forensic reports.",
    });
  }
};

/* =========================================================
   GET ONE REPORT
========================================================= */

const getReport = async (
  req,
  res
) => {
  try {
    if (!db) {
      return res.status(503).json({
        message:
          "Firestore is unavailable.",
      });
    }

    const {
      reportId,
    } = req.params;

    if (!reportId) {
      return res.status(400).json({
        message:
          "Report ID is required.",
      });
    }

    const snapshot =
      await db
        .collection("forensicReports")
        .doc(reportId)
        .get();

    if (!snapshot.exists) {
      return res.status(404).json({
        message:
          "Forensic report not found.",
      });
    }

    return res.json({
      id: snapshot.id,
      ...snapshot.data(),
    });
  } catch (error) {
    console.error(
      "Unable to load forensic report:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load forensic report.",
    });
  }
};

/* =========================================================
   DELETE REPORT
========================================================= */

const deleteReport = async (
  req,
  res
) => {
  try {
    if (!db) {
      return res.status(503).json({
        message:
          "Firestore is unavailable.",
      });
    }

    const {
      reportId,
    } = req.params;

    if (!reportId) {
      return res.status(400).json({
        message:
          "Report ID is required.",
      });
    }

    const snapshot =
      await db
        .collection("forensicReports")
        .doc(reportId)
        .get();

    if (!snapshot.exists) {
      return res.status(404).json({
        message:
          "Forensic report not found.",
      });
    }

    await db
      .collection("forensicReports")
      .doc(reportId)
      .delete();

    return res.json({
      message:
        "Forensic report deleted successfully.",

      reportId,
    });
  } catch (error) {
    console.error(
      "Unable to delete forensic report:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to delete forensic report.",
    });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  generateReport,
  getReports,
  getReport,
  deleteReport,
};