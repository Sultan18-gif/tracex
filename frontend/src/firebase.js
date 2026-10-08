import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBjWAlMRN60z7ex97LOXVSLHXZUBHx77C8",
  authDomain: "crypto-fraud-investigation.firebaseapp.com",
  projectId: "crypto-fraud-investigation",
  storageBucket: "crypto-fraud-investigation.firebasestorage.app",
  messagingSenderId: "960319300249",
  appId: "1:960319300249:web:d9682b92f936cfa0f14e08",
  measurementId: "G-ZZV6H7N2QP",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export default app;