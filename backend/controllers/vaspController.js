const { db } = require("../firebase");
const axios = require("axios");

const VASP_COLLECTION = "vasps";

async function geocodeLocation(physicalLocation, country = "", jurisdiction = "") {
  const query = [physicalLocation, jurisdiction, country]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  if (!query) {
    return {
      latitude: null,
      longitude: null,
      locationLabel: "",
      locationSource: "",
    };
  }

  let lookupFailed = false;

  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: { q: query, format: "jsonv2", limit: 1 },
        headers: {
          "User-Agent": process.env.GEOCODING_USER_AGENT || "TraceX-VASP-Locator/1.0",
          "Accept-Language": "en",
        },
        timeout: 10000,
      }
    );

    const match = Array.isArray(response.data) ? response.data[0] : null;
    const latitude = Number(match?.lat);
    const longitude = Number(match?.lon);

    if (match && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        latitude,
        longitude,
        locationLabel: match.display_name || query,
        locationSource: "OpenStreetMap",
      };
    }
  } catch (error) {
    lookupFailed = true;
    console.warn("OpenStreetMap location lookup failed:", error.message);
  }

  try {
    const response = await axios.get("https://photon.komoot.io/api/", {
      params: { q: query, limit: 1, lang: "en" },
      timeout: 10000,
    });
    const match = Array.isArray(response.data?.features)
      ? response.data.features[0]
      : null;
    const [longitude, latitude] = match?.geometry?.coordinates || [];

    if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
      const properties = match.properties || {};
      const label = [
        properties.name,
        properties.city,
        properties.state,
        properties.country,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        latitude: Number(latitude),
        longitude: Number(longitude),
        locationLabel: label || query,
        locationSource: "OpenStreetMap",
      };
    }
  } catch (error) {
    lookupFailed = true;
    console.warn("Fallback location lookup failed:", error.message);
  }

  const error = new Error(
    lookupFailed
      ? "The map location lookup is unavailable. Please try again."
      : "No map location was found. Enter a more specific physical address, city, or country."
  );
  error.statusCode = lookupFailed ? 503 : 422;
  throw error;
}

function normalizeVasp(data = {}, id = null) {
  return {
    id,
    name: data.name || "",
    type: data.type || "Exchange",
    country: data.country || "",
    jurisdiction: data.jurisdiction || "",
    physicalLocation: data.physicalLocation || data.location || "",
    latitude: data.latitude ?? data.lat ?? null,
    longitude: data.longitude ?? data.lng ?? null,
    locationLabel: data.locationLabel || "",
    locationSource: data.locationSource || "",
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
      physicalLocation,
      latitude,
      longitude,
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

    const location = await geocodeLocation(physicalLocation, country, jurisdiction);

    const now = new Date().toISOString();

    const vaspData = {
      name: name.trim(),
      type: type || "Exchange",
      country: country || "",
      jurisdiction: jurisdiction || "",
      physicalLocation: physicalLocation || "",
      latitude: location.latitude,
      longitude: location.longitude,
      locationLabel: location.locationLabel,
      locationSource: location.locationSource,
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

    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to create VASP",
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
      "physicalLocation",
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

    if (updates.physicalLocation !== undefined || updates.country !== undefined) {
      const current = existing.data();
      const location = await geocodeLocation(
        updates.physicalLocation ?? current.physicalLocation,
        updates.country ?? current.country,
        updates.jurisdiction ?? current.jurisdiction
      );
      updates.latitude = location.latitude;
      updates.longitude = location.longitude;
      updates.locationLabel = location.locationLabel;
      updates.locationSource = location.locationSource;
    }

    updates.updatedAt = new Date().toISOString();

    await docRef.update(updates);

    const updated = await docRef.get();

    res.json(
      normalizeVasp(updated.data(), updated.id)
    );
  } catch (error) {
    console.error("Error updating VASP:", error);

    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to update VASP",
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
