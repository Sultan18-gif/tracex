const { db } = require("../firebase");

const VASP_COLLECTION = "vasps";

function normalizeVasp(data = {}, id = null) {
  return {
    id,
    name: data.name || "",
    type: data.type || "Exchange",
    country: data.country || "",
    jurisdiction: data.jurisdiction || "",
    riskLevel: data.riskLevel || "Unknown",
    status: data.status || "Active",
    website: data.website || "",
    addresses: Array.isArray(data.addresses) ? data.addresses : [],
    notes: data.notes || "",
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

exports.getVASPs = async (req, res) => {
  try {
    const snapshot = await db
      .collection(VASP_COLLECTION)
      .orderBy("name")
      .get();

    const vasps = snapshot.docs.map((doc) =>
      normalizeVasp(doc.data(), doc.id)
    );

    res.json(vasps);
  } catch (error) {
    console.error("Error fetching VASPs:", error);
    res.status(500).json({
      message: "Failed to fetch VASPs",
      error: error.message,
    });
  }
};

exports.getVASP = async (req, res) => {
  try {
    const { vaspId } = req.params;

    const doc = await db
      .collection(VASP_COLLECTION)
      .doc(vaspId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "VASP not found",
      });
    }

    res.json(normalizeVasp(doc.data(), doc.id));
  } catch (error) {
    console.error("Error fetching VASP:", error);

    res.status(500).json({
      message: "Failed to fetch VASP",
      error: error.message,
    });
  }
};

exports.createVASP = async (req, res) => {
  try {
    const {
      name,
      type,
      country,
      jurisdiction,
      riskLevel,
      status,
      website,
      addresses,
      notes,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "VASP name is required.",
      });
    }

    const now = new Date().toISOString();

    const vaspData = {
      name: name.trim(),
      type: type || "Exchange",
      country: country || "",
      jurisdiction: jurisdiction || "",
      riskLevel: riskLevel || "Unknown",
      status: status || "Active",
      website: website || "",
      addresses: Array.isArray(addresses) ? addresses : [],
      notes: notes || "",
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db
      .collection(VASP_COLLECTION)
      .add(vaspData);

    res.status(201).json(
      normalizeVasp(vaspData, docRef.id)
    );
  } catch (error) {
    console.error("Error creating VASP:", error);

    res.status(500).json({
      message: "Failed to create VASP",
      error: error.message,
    });
  }
};

exports.updateVASP = async (req, res) => {
  try {
    const { vaspId } = req.params;

    const docRef = db
      .collection(VASP_COLLECTION)
      .doc(vaspId);

    const existing = await docRef.get();

    if (!existing.exists) {
      return res.status(404).json({
        message: "VASP not found",
      });
    }

    const allowedFields = [
      "name",
      "type",
      "country",
      "jurisdiction",
      "riskLevel",
      "status",
      "website",
      "addresses",
      "notes",
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);

    const updated = await docRef.get();

    res.json(
      normalizeVasp(updated.data(), updated.id)
    );
  } catch (error) {
    console.error("Error updating VASP:", error);

    res.status(500).json({
      message: "Failed to update VASP",
      error: error.message,
    });
  }
};

exports.deleteVASP = async (req, res) => {
  try {
    const { vaspId } = req.params;

    const docRef = db
      .collection(VASP_COLLECTION)
      .doc(vaspId);

    const existing = await docRef.get();

    if (!existing.exists) {
      return res.status(404).json({
        message: "VASP not found",
      });
    }

    await docRef.delete();

    res.json({
      message: "VASP deleted successfully",
      id: vaspId,
    });
  } catch (error) {
    console.error("Error deleting VASP:", error);

    res.status(500).json({
      message: "Failed to delete VASP",
      error: error.message,
    });
  }
};