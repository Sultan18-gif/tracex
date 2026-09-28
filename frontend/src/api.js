export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "/api"
).replace(/\/$/, "");

const API_URL = API_BASE_URL;

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


// ADD THIS
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
