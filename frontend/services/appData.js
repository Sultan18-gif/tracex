import { auth } from "../src/firebase.js";
import { API_BASE_URL } from "../src/api.js";

const API_URL = API_BASE_URL;

/* =========================================================
   API HELPER
========================================================= */

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

/* =========================================================
   APP DATA
========================================================= */

export async function getAppData() {
  const [cases, wallets, reports] = await Promise.all([
    getCases(),
    getWallets(),
    getReports(),
  ]);

  return {
    investigations: [],
    cases,
    reports,
    wallets,
  };
}

/* =========================================================
   INVESTIGATIONS
========================================================= */

export async function getInvestigations() {
  return [];
}

export async function getInvestigation() {
  return null;
}

export async function saveInvestigation() {
  throw new Error(
    "Investigation storage is not available in the current backend."
  );
}

/* =========================================================
   WALLETS
========================================================= */

export async function getWallets() {
  const data = await apiRequest("/wallets");

  return Array.isArray(data) ? data : [];
}

export async function getWallet(address) {
  if (!address) {
    return null;
  }

  const wallets = await getWallets();

  return (
    wallets.find(
      (wallet) =>
        String(wallet.address).toLowerCase() ===
        String(address).toLowerCase()
    ) || null
  );
}

export async function analyzeWallet(walletAddress) {
  if (!walletAddress) {
    throw new Error("Wallet address is required.");
  }

  return apiRequest("/wallets/analyze", {
    method: "POST",
    body: JSON.stringify({
      walletAddress,
    }),
  });
}

/* =========================================================
   TRANSACTIONS
========================================================= */

export async function getTransactions(walletAddress) {
  if (!walletAddress) {
    return [];
  }

  const data = await apiRequest(
    `/transactions/${encodeURIComponent(walletAddress)}`
  );

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.transactions)) {
    return data.transactions;
  }

  return [];
}

/* =========================================================
   CASES
========================================================= */

export async function getCases() {
  const data = await apiRequest("/cases");

  return Array.isArray(data)
    ? data.map(normalizeCase)
    : [];
}

export async function getCase(caseId) {
  if (!caseId) {
    return null;
  }

  const cases = await getCases();

  return (
    cases.find(
      (investigationCase) =>
        investigationCase.id === caseId ||
        investigationCase.caseId === caseId
    ) || null
  );
}

/* =========================================================
   NORMALIZE CASE
========================================================= */

function normalizeCase(item) {
  if (!item) {
    return item;
  }

  const walletAddress =
    item.walletAddress ||
    (Array.isArray(item.wallets)
      ? item.wallets[0]?.address ||
        item.wallets[0] ||
        ""
      : "");

  return {
    ...item,

    id: item.id || item.caseId,

    caseId:
      item.caseId ||
      item.id,

    title:
      item.title ||
      "Fraud Investigation",

    description:
      item.description ||
      "",

    walletAddress,

    wallets:
      Array.isArray(item.wallets)
        ? item.wallets
        : walletAddress
        ? [walletAddress]
        : [],

    priority:
      item.priority ||
      item.riskScore ||
      "Medium",

    riskScore:
      item.riskScore ||
      item.priority ||
      "Medium",

    status:
      item.status ||
      "Open",

    agent:
      item.agent ||
      "Senior Investigator",

    opened:
      item.opened ||
      formatDate(item.createdAt),

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      item.createdAt ||
      null,

    transactions:
      Array.isArray(item.transactions)
        ? item.transactions
        : [],

    findings:
      Array.isArray(item.findings)
        ? item.findings
        : [],
  };
}

function getWalletAddressFromCase(caseData) {
  if (caseData?.walletAddress) {
    return caseData.walletAddress;
  }

  if (Array.isArray(caseData?.wallets)) {
    const wallet = caseData.wallets[0];

    if (typeof wallet === "string") {
      return wallet;
    }

    if (wallet?.address) {
      return wallet.address;
    }
  }

  return "";
}

/* =========================================================
   CREATE CASE
========================================================= */

export async function createCase(caseData = {}) {
  const walletAddress =
    getWalletAddressFromCase(caseData);

  const description =
    caseData.description?.trim() || "";

  if (!walletAddress) {
    throw new Error(
      "Wallet address is required."
    );
  }

  if (!description) {
    throw new Error(
      "Case description is required."
    );
  }

  const payload = {
    walletAddress,
    description,

    title:
      caseData.title?.trim() ||
      "Fraud Investigation",

    riskScore:
      caseData.riskScore ||
      caseData.priority ||
      "Medium",
  };

  const data = await apiRequest("/cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeCase(data);
}

export async function updateCase() {
  throw new Error(
    "Case updates are not supported by the current backend."
  );
}

export async function deleteCase() {
  throw new Error(
    "Case deletion is not supported by the current backend."
  );
}

/* =========================================================
   REPORTS
========================================================= */

/*
  Report API:

    POST /api/reports/generate
    GET  /api/reports
    GET  /api/reports/:reportId
*/

export async function getReports() {
  const data = await apiRequest("/reports");

  return Array.isArray(data)
    ? data
    : Array.isArray(data?.reports)
    ? data.reports
    : [];
}

export async function getReport(reportId) {
  if (!reportId) {
    throw new Error("Report ID is required.");
  }

  return apiRequest(
    `/reports/${encodeURIComponent(reportId)}`
  );
}

export async function generateReport(caseId) {
  if (!caseId) {
    throw new Error(
      "A case ID is required to generate a report."
    );
  }

  return apiRequest("/reports/generate", {
    method: "POST",
    body: JSON.stringify({
      caseId,
    }),
  });
}

export async function deleteReport(reportId) {
  if (!reportId) {
    throw new Error("Report ID is required.");
  }

  return apiRequest(
    `/reports/${encodeURIComponent(reportId)}`,
    {
      method: "DELETE",
    }
  );
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

export async function getDashboardStats() {
  const [cases, wallets, reports] =
    await Promise.all([
      getCases(),
      getWallets(),
      getReports(),
    ]);

  const activeCases = cases.filter(
    (item) =>
      item.status !== "Closed" &&
      item.status !== "Resolved"
  );

  const criticalCases = cases.filter(
    (item) =>
      String(
        item.priority ||
          item.riskScore ||
          ""
      ).toLowerCase() === "critical"
  );

  const walletSet = new Set();

  wallets.forEach((wallet) => {
    if (wallet?.address) {
      walletSet.add(wallet.address);
    }
  });

  cases.forEach((item) => {
    if (Array.isArray(item.wallets)) {
      item.wallets.forEach((wallet) => {
        if (typeof wallet === "string") {
          walletSet.add(wallet);
        } else if (wallet?.address) {
          walletSet.add(wallet.address);
        }
      });
    }

    if (item.walletAddress) {
      walletSet.add(item.walletAddress);
    }
  });

  let transactionCount = 0;

  cases.forEach((item) => {
    if (Array.isArray(item.transactions)) {
      transactionCount += item.transactions.length;
    }
  });

  return {
    totalCases: cases.length,

    activeCases:
      activeCases.length,

    criticalCases:
      criticalCases.length,

    walletsTracked:
      walletSet.size,

    transactionsAnalyzed:
      transactionCount,

    investigations: 0,

    reportsGenerated:
      reports.length,
  };
}

/* =========================================================
   VASPs
========================================================= */

export async function getVASPs() {
  const data = await apiRequest("/vasps");

  return Array.isArray(data)
    ? data
    : [];
}

export async function getVASP(vaspId) {
  if (!vaspId) {
    return null;
  }

  return apiRequest(
    `/vasps/${encodeURIComponent(vaspId)}`
  );
}

export async function createVASP(vaspData = {}) {
  if (!vaspData.name?.trim()) {
    throw new Error(
      "VASP name is required."
    );
  }

  return apiRequest("/vasps", {
    method: "POST",

    body: JSON.stringify({
      name: vaspData.name.trim(),
      type:
        vaspData.type ||
        "Exchange",
      country:
        vaspData.country ||
        "",
      jurisdiction:
        vaspData.jurisdiction ||
        "",
      riskLevel:
        vaspData.riskLevel ||
        "Unknown",
      status:
        vaspData.status ||
        "Active",
      website:
        vaspData.website ||
        "",
      addresses:
        Array.isArray(
          vaspData.addresses
        )
          ? vaspData.addresses
          : [],
      notes:
        vaspData.notes ||
        "",
    }),
  });
}

export async function updateVASP(
  vaspId,
  vaspData = {}
) {
  if (!vaspId) {
    throw new Error(
      "VASP ID is required."
    );
  }

  return apiRequest(
    `/vasps/${encodeURIComponent(vaspId)}`,
    {
      method: "PUT",
      body: JSON.stringify(
        vaspData
      ),
    }
  );
}

export async function deleteVASP(vaspId) {
  if (!vaspId) {
    throw new Error(
      "VASP ID is required."
    );
  }

  return apiRequest(
    `/vasps/${encodeURIComponent(vaspId)}`,
    {
      method: "DELETE",
    }
  );
}

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    const date =
      value?.toDate instanceof Function
        ? value.toDate()
        : new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date
      .toISOString()
      .slice(0, 10);
  } catch {
    return "";
  }
}

/*
  Backend stores application data.
*/

export function clearAppData() {
  console.warn(
    "clearAppData() is disabled because application data is stored in the backend."
  );
}