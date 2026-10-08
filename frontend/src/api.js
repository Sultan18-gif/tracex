/* =========================================================
   TRACEX API CONFIGURATION
   Frontend + Backend are served from the same URL
========================================================= */

export const API_BASE_URL = "/api";

const API_URL = API_BASE_URL;

/* =========================================================
   API REQUEST HELPER
========================================================= */

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
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
   WALLETS
========================================================= */

export async function getWallets() {
  return apiRequest("/wallets");
}

export async function getWallet(address) {
  if (!address) {
    return null;
  }

  const data = await getWallets();

  const wallets = Array.isArray(data)
    ? data
    : Array.isArray(data?.wallets)
    ? data.wallets
    : [];

  return (
    wallets.find(
      (wallet) =>
        String(wallet.address || "").toLowerCase() ===
        String(address).toLowerCase()
    ) || null
  );
}

/* =========================================================
   WALLET ANALYSIS
========================================================= */

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