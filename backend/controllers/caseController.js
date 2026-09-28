const { db } = require("../firebase");

// Create a new case
const createCase = async (req, res) => {
  try {
    const {
      walletAddress,
      description,
      title,
      priority,
      riskScore,
      createdBy
    } = req.body || {};

    const now = new Date();

    const newCase = {
      // Automatically generated case ID
      caseId: `CASE-${Date.now()}`,

      // Basic case information
      title:
        title?.trim() ||
        "New Blockchain Investigation",

      walletAddress:
        walletAddress?.trim() || "",

      description:
        description?.trim() ||
        "New blockchain investigation case.",

      // Risk / priority
      priority:
        priority ||
        riskScore ||
        "Medium",

      riskScore:
        riskScore ||
        priority ||
        "Medium",

      // Case status
      status: "Open",

      // Investigator
      createdBy:
        createdBy ||
        "Investigator",

      // Creation time
      createdAt: now,

      // Investigation data
      wallets: walletAddress?.trim()
        ? [walletAddress.trim()]
        : [],

      transactions: [],

      findings: [],

      evidence: [],

      tracedWallets: [],

      detectedExchanges: [],

      alerts: []
    };

    // Save case to Firebase Firestore
    const docRef = await db
      .collection("cases")
      .add(newCase);

    // Send created case back to frontend
    res.status(201).json({
      id: docRef.id,
      ...newCase
    });

  } catch (error) {
    console.error(
      "Error creating case:",
      error
    );

    res.status(500).json({
      message: "Unable to create case",
      error: error.message
    });
  }
};


// Get all cases
const getCases = async (req, res) => {
  try {
    const snapshot = await db
      .collection("cases")
      .orderBy("createdAt", "desc")
      .get();

    const cases = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(cases);

  } catch (error) {
    console.error(
      "Error fetching cases:",
      error
    );

    res.status(500).json({
      message: "Unable to fetch cases",
      error: error.message
    });
  }
};


module.exports = {
  createCase,
  getCases
};