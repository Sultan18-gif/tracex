const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5001/api";

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
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

/* =========================================================
   APP DATA
   ========================================================= */

export async function getAppData() {
  const [cases, wallets] = await Promise.all([
    getCases(),
    getWallets(),
  ]);

  return {
    investigations: [],
    cases,
    reports: [],
    wallets,
  };
}

/* =========================================================
   INVESTIGATIONS
   ========================================================= */

/*
  The current backend does not expose an investigations route.
  Keep these functions available so existing frontend imports
  do not break.
*/

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

  /*
    Backend returns:

    {
      walletAddress: "...",
      transactions: []
    }

    rather than directly returning the array.
  */

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

/*
  Frontend case structure:
    wallets
    priority
    status
    agent

  Backend case structure:
    walletAddress
    riskScore
    status
*/

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

/*
  The current backend does not expose PUT/PATCH for cases.
  Do not write to localStorage or pretend the update succeeded.
*/

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
  The current backend only supports:

    POST /api/reports/generate

  There is no GET /api/reports endpoint yet.
*/

export async function getReports() {
  return [];
}

export async function getReport() {
  return null;
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

export async function deleteReport() {
  throw new Error(
    "Report deletion is not supported by the current backend."
  );
}

/* =========================================================
   DASHBOARD STATISTICS
   ========================================================= */

export async function getDashboardStats() {
  const [cases, wallets] = await Promise.all([
    getCases(),
    getWallets(),
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

  /*
    The case API does not contain transaction arrays.

    Therefore transaction count is taken from the transactions
    attached to cases when available. We do not fabricate a
    transaction count from unavailable backend data.
  */

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

    reportsGenerated: 0,
  };
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

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/*
  Kept only for compatibility with any existing imports.

  Application data is now stored in the backend,
  not in browser localStorage.
*/

export function clearAppData() {
  console.warn(
    "clearAppData() is disabled because application data is stored in the backend."
  );
}