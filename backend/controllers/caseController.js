const { db } = require("../firebase");

// Create a new case
const createCase = async (req, res) => {
  try {
    const { walletAddress, description, title, riskScore } = req.body;

    if (!walletAddress || !description) {
      return res.status(400).json({
        message: "Wallet address and description are required"
      });
    }

    const newCase = {
      caseId: `CASE-${Date.now()}`,
      title: title || "Fraud Investigation",
      walletAddress,
      description,
      riskScore: riskScore || "Medium",
      status: "Open",
      createdAt: new Date()
    };

    const docRef = await db.collection("cases").add(newCase);

    res.status(201).json({
      id: docRef.id,
      ...newCase
    });

  } catch (error) {
    console.error("Error creating case:", error);

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
    console.error("Error fetching cases:", error);

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