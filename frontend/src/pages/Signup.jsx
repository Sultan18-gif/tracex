import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { startRegistration } from "@simplewebauthn/browser";

import { auth } from "../firebase";
import { API_BASE_URL } from "../api";

import { FaceRecognition } from "./Login";

import "../styles/theme.css";

function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);

  const [accountCreated, setAccountCreated] = useState(false);
  const [fingerprintRegistered, setFingerprintRegistered] =
    useState(false);
  const [faceRegistered, setFaceRegistered] =
    useState(false);

  const [faceMode, setFaceMode] = useState(null);

  // ============================================================
  // CREATE ACCOUNT
  // ============================================================

  const handleSignup = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const userEmail = email.trim().toLowerCase();

    if (!userEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await createUserWithEmailAndPassword(
        auth,
        userEmail,
        password
      );

      setAccountCreated(true);

      setSuccess(
        "Account created successfully. You can now register your biometric security."
      );
    } catch (error) {
      console.error("SIGNUP ERROR:", error);

      switch (error.code) {
        case "auth/email-already-in-use":
          setError(
            "An account already exists with this email address."
          );
          break;

        case "auth/invalid-email":
          setError(
            "Please enter a valid email address."
          );
          break;

        case "auth/weak-password":
          setError(
            "Password must be at least 6 characters."
          );
          break;

        case "auth/network-request-failed":
          setError(
            "Network error. Please check your internet connection."
          );
          break;

        default:
          setError(
            error.message ||
              "Unable to create your account."
          );
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // WINDOWS HELLO / FINGERPRINT
  // ============================================================

  const handleFingerprintRegistration = async () => {
    setError("");
    setSuccess("");

    if (!accountCreated) {
      setError(
        "Create your TraceX account first."
      );
      return;
    }

    const userEmail = email.trim().toLowerCase();

    if (!userEmail) {
      setError("Email address is required.");
      return;
    }

    try {
      setLoading(true);

      // Get WebAuthn registration options
      const optionsResponse = await fetch(
        `${API_BASE_URL}/webauthn/register/options`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: userEmail,
          }),
        }
      );

      const optionsText =
        await optionsResponse.text();

      let optionsData;

      try {
        optionsData = JSON.parse(optionsText);
      } catch {
        throw new Error(
          `Backend returned an invalid response (${optionsResponse.status}).`
        );
      }

      if (!optionsResponse.ok) {
        throw new Error(
          optionsData.error ||
            "Unable to start Windows Hello registration."
        );
      }

      // Open Windows Hello
      const registrationResponse =
        await startRegistration({
          optionsJSON: optionsData,
        });

      // Verify registration with backend
      const verifyResponse = await fetch(
        `${API_BASE_URL}/webauthn/register/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: userEmail,
            response: registrationResponse,
          }),
        }
      );

      const verifyText =
        await verifyResponse.text();

      let verifyData;

      try {
        verifyData = JSON.parse(verifyText);
      } catch {
        throw new Error(
          `Backend returned an invalid verification response (${verifyResponse.status}).`
        );
      }

      if (
        !verifyResponse.ok ||
        !verifyData.verified
      ) {
        throw new Error(
          verifyData.error ||
            "Windows Hello registration failed."
        );
      }

      setFingerprintRegistered(true);

      setSuccess(
        "Windows Hello / fingerprint registered successfully."
      );
    } catch (error) {
      console.error(
        "FINGERPRINT REGISTRATION ERROR:",
        error
      );

      if (
        error.name === "NotAllowedError"
      ) {
        setError(
          "Windows Hello was cancelled or not completed."
        );
      } else if (
        error.name === "InvalidStateError"
      ) {
        setError(
          "Windows Hello is already registered for this account."
        );
      } else if (
        error.message === "Failed to fetch"
      ) {
        setError(
          "Cannot connect to the TraceX backend. Make sure the backend is running."
        );
      } else {
        setError(
          error.message ||
            "Windows Hello registration failed."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FACE REGISTRATION
  // ============================================================

  const handleFaceRegistration = () => {
    setError("");
    setSuccess("");

    if (!accountCreated) {
      setError(
        "Create your TraceX account first."
      );
      return;
    }

    setFaceMode("register");
  };

  // ============================================================
  // FACE SUCCESS
  // ============================================================

  const handleFaceSuccess = (result) => {
    if (!result) {
      return;
    }

    if (result.type === "register") {
      setFaceMode(null);
      setFaceRegistered(true);

      setError("");

      setSuccess(
        "Face recognition registered successfully."
      );
    }
  };

  // ============================================================
  // FACE CLOSE
  // ============================================================

  const handleFaceClose = () => {
    setFaceMode(null);
  };

  // ============================================================
  // COMPLETE REGISTRATION
  // ============================================================

  const handleCompleteRegistration = () => {
    setError("");

    if (!accountCreated) {
      setError(
        "Create your account first."
      );
      return;
    }

    if (!fingerprintRegistered) {
      setError(
        "Please register Windows Hello / fingerprint first."
      );
      return;
    }

    if (!faceRegistered) {
      setError(
        "Please register face recognition first."
      );
      return;
    }

    setSuccess(
      "Registration completed successfully. Redirecting to login..."
    );

    setTimeout(() => {
      navigate("/");
    }, 1500);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="signup-page">

      {/* BACKGROUND */}

      <div className="signup-grid"></div>

      <div className="signup-glow signup-glow-one"></div>
      <div className="signup-glow signup-glow-two"></div>

      <div className="signup-wrapper">

        {/* ====================================================
            BRAND
        ==================================================== */}

        <div className="signup-brand">

          <div className="signup-logo">
            CS
          </div>

          <h1>TraceX</h1>

          <p>
            Crypto Fraud Investigation Suite
          </p>

        </div>

        {/* ====================================================
            CARD
        ==================================================== */}

        <div className="signup-card">

          {/* HEADER */}

          <div className="signup-header">

            <div>

              <h2>
                Create Account
              </h2>

              <p>
                Register your TraceX investigator account
              </p>

            </div>

            {accountCreated && (
              <div className="signup-account-badge">
                <span></span>
                ACCOUNT CREATED
              </div>
            )}

          </div>

          {/* ==================================================
              ACCOUNT FORM
          ================================================== */}

          {!accountCreated && (
            <form
              className="signup-form"
              onSubmit={handleSignup}
            >

              {/* EMAIL */}

              <div className="signup-field">

                <label htmlFor="signup-email">
                  Email Address
                </label>

                <div className="signup-input-wrapper">

                  <span className="input-icon">
                    @
                  </span>

                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="investigator@example.com"
                    autoComplete="email"
                    disabled={loading}
                  />

                </div>

              </div>

              {/* PASSWORD */}

              <div className="signup-field">

                <label htmlFor="signup-password">
                  Password
                </label>

                <div className="signup-input-wrapper">

                  <span className="input-icon">
                    •
                  </span>

                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Create a password"
                    autoComplete="new-password"
                    disabled={loading}
                  />

                </div>

              </div>

              {/* CONFIRM PASSWORD */}

              <div className="signup-field">

                <label htmlFor="signup-confirm-password">
                  Confirm Password
                </label>

                <div className="signup-input-wrapper">

                  <span className="input-icon">
                    •
                  </span>

                  <input
                    id="signup-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    disabled={loading}
                  />

                </div>

              </div>

              {/* CREATE ACCOUNT */}

              <button
                type="submit"
                className="signup-create-button"
                disabled={loading}
              >

                {loading ? (
                  <>
                    <span className="signup-spinner"></span>
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <span>→</span>
                  </>
                )}

              </button>

            </form>
          )}

          {/* ==================================================
              ACCOUNT CREATED
          ================================================== */}

          {accountCreated && (
            <div className="account-created-panel">

              <div className="account-created-icon">
                ✓
              </div>

              <div>

                <strong>
                  Account Created Successfully
                </strong>

                <span>
                  {email}
                </span>

              </div>

            </div>
          )}

          {/* ==================================================
              ERROR
          ================================================== */}

          {error && (
            <div className="signup-message signup-error">

              <span className="message-icon">
                !
              </span>

              <span>
                {error}
              </span>

            </div>
          )}

          {/* ==================================================
              SUCCESS
          ================================================== */}

          {success && (
            <div className="signup-message signup-success">

              <span className="message-icon">
                ✓
              </span>

              <span>
                {success}
              </span>

            </div>
          )}

          {/* ==================================================
              BIOMETRIC SECTION
          ================================================== */}

          <div className="biometric-section">

            <div className="biometric-heading">

              <div className="biometric-heading-icon">
                <span>+</span>
              </div>

              <div>

                <h3>
                  Biometric Authentication
                </h3>

                <p>
                  Secure your TraceX account with biometrics.
                </p>

              </div>

            </div>

            {/* =================================================
                WINDOWS HELLO / FINGERPRINT
            ================================================= */}

            <button
              type="button"
              className="register-hello-button biometric-button"
              onClick={handleFingerprintRegistration}
              disabled={
                loading ||
                fingerprintRegistered
              }
            >

              <div className="biometric-card-icon fingerprint-icon">
                <span></span>
              </div>

              <div className="biometric-card-text">

                <strong>
                  {fingerprintRegistered
                    ? "Windows Hello Registered"
                    : "Register Fingerprint / Windows Hello"}
                </strong>

                <small>
                  {fingerprintRegistered
                    ? "Credential successfully registered"
                    : accountCreated
                    ? "Use your Windows biometric security"
                    : "Create your account first"}
                </small>

              </div>

              <div className="biometric-arrow">
                {fingerprintRegistered
                  ? "✓"
                  : "→"}
              </div>

            </button>

            {/* =================================================
                FACE RECOGNITION
            ================================================= */}

            <button
              type="button"
              className="register-hello-button biometric-button"
              onClick={handleFaceRegistration}
              disabled={
                loading ||
                faceRegistered
              }
            >

              <div className="biometric-card-icon face-icon">

                <div className="face-icon-head">
                  <span></span>
                </div>

              </div>

              <div className="biometric-card-text">

                <strong>
                  {faceRegistered
                    ? "Face Recognition Registered"
                    : "Register Face Recognition"}
                </strong>

                <small>
                  {faceRegistered
                    ? "Face profile successfully registered"
                    : accountCreated
                    ? "Secure browser-based face verification"
                    : "Create your account first"}
                </small>

              </div>

              <div className="biometric-arrow">
                {faceRegistered
                  ? "✓"
                  : "→"}
              </div>

            </button>

            {/* =================================================
                COMPLETE REGISTRATION
            ================================================= */}

            <button
              type="button"
              className="complete-registration-button"
              onClick={
                handleCompleteRegistration
              }
              disabled={
                loading ||
                !accountCreated ||
                !fingerprintRegistered ||
                !faceRegistered
              }
            >

              <span className="complete-icon">
                ✓
              </span>

              <span>
                Complete Registration
              </span>

              <span>
                →
              </span>

            </button>

          </div>

          {/* ==================================================
              DIVIDER
          ================================================== */}

          <div className="signup-divider">

            <span></span>

            <p>OR</p>

            <span></span>

          </div>

          {/* ==================================================
              SIGN IN
          ================================================== */}

          <button
            type="button"
            className="signup-signin-button"
            onClick={() => navigate("/")}
            disabled={loading || !!faceMode}
          >
            Already have an account?
            <strong> Sign In</strong>
          </button>

          {/* ==================================================
              SECURITY
          ================================================== */}

          <div className="signup-security">

            <span className="security-pulse"></span>

            <span>
              Protected with Firebase + Windows Hello + Face Recognition
            </span>

          </div>

        </div>

        {/* FOOTER */}

        <div className="signup-footer">

          <span>TraceX</span>

          <b>•</b>

          <span>
            Blockchain Intelligence Platform
          </span>

        </div>

      </div>

      {/* ======================================================
          FACE CAMERA
      ====================================================== */}

      {faceMode === "register" && (
        <FaceRecognition
          email={email.trim().toLowerCase()}
          mode="register"
          onSuccess={handleFaceSuccess}
          onClose={handleFaceClose}
        />
      )}

    </div>
  );
}

export default Signup;