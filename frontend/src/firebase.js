
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_FIREBASE_API_KEY",
  authDomain: "crypto-fraud-investigation.firebaseapp.com",
  projectId: "crypto-fraud-investigation",
  storageBucket: "crypto-fraud-investigation.firebasestorage.app",
  messagingSenderId: "960319300249",
  appId: "1:960319300249:web:d9682b92f936cfa0f14e08",
  measurementId: "G-ZZV6H7N2QP"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch((error) => {
      console.warn("Firebase Analytics unavailable:", error);
    });
}

export default app;
