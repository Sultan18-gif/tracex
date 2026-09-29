import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";

import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

import { auth } from "../firebase";
import { API_BASE_URL } from "../api";
import * as faceapi from "@vladmandic/face-api";
import "../styles/theme.css";

const FACE_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model";

let faceModelsLoaded = false;
let faceModelsPromise = null;

async function loadFaceModels() {
  if (faceModelsLoaded) return;

  if (!faceModelsPromise) {
    faceModelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
    ]);
  }

  await faceModelsPromise;
  faceModelsLoaded = true;
}

function averageDescriptors(descriptors) {
  const result = new Array(descriptors[0].length).fill(0);

  for (const descriptor of descriptors) {
    for (let i = 0; i < descriptor.length; i++) {
      result[i] += descriptor[i];
    }
  }

  for (let i = 0; i < result.length; i++) {
    result[i] /= descriptors.length;
  }

  return result;
}

function FaceRecognition({ email, mode, onSuccess, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("Loading face recognition...");
  const [cameraReady, setCameraReady] = useState(false);
 const [processing, setProcessing] = useState(false);
const autoCaptureRef = useRef(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        setStatus("Loading face recognition models...");
        await loadFaceModels();

        if (!mounted) return;

        setStatus("Opening camera...");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = resolve;
        });

        await videoRef.current.play();
        setCameraReady(true);
        setStatus(
          mode === "register"
             ? "Look at the camera. Your face will be registered automatically."
    : "Look at the camera."
        );
      } catch (error) {
        console.error("FACE CAMERA ERROR:", error);
        setCameraError(
          error.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access and try again."
            : error.name === "NotFoundError"
            ? "No camera was found. Connect a webcam and try again."
            : error.message || "Unable to start face recognition."
        );
      }
    };

    start();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [mode]);

  const detectFace = async () => {
    const detections = await faceapi
      .detectAllFaces(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      throw new Error("No face detected. Move closer and look at the camera.");
    }

    if (detections.length > 1) {
      throw new Error("Only one face should be visible.");
    }

    return detections[0].descriptor;
  };

  const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

 const handleRegister = async () => {
  if (processing || autoCaptureRef.current) return;

  try {
    autoCaptureRef.current = true;
    setProcessing(true);

    const descriptors = [];

    for (let i = 0; i < 3; i++) {
      setStatus(`Face detected. Capturing ${i + 1} of 3...`);

      descriptors.push(
        Array.from(await detectFace())
      );

      if (i < 2) {
        await sleep(700);
      }
    }

    const descriptor = averageDescriptors(descriptors);

    const key =
      `chainSentryFace:${email.trim().toLowerCase()}`;

    localStorage.setItem(
      key,
      JSON.stringify({
        descriptor,
        createdAt: new Date().toISOString(),
      })
    );

    setStatus("Face registered successfully.");

    await sleep(500);

    onSuccess({
      type: "register",
    });

  } catch (error) {
    console.error(
      "FACE REGISTRATION ERROR:",
      error
    );

    setStatus(
      error.message ||
      "Face registration failed."
    );

    autoCaptureRef.current = false;

  } finally {
    setProcessing(false);
  }
};
useEffect(() => {
  if (mode !== "register" || !cameraReady) {
    return;
  }

  let cancelled = false;

  const autoDetect = async () => {
    if (cancelled || autoCaptureRef.current) {
      return;
    }

    try {
      const detections = await faceapi
        .detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (cancelled || autoCaptureRef.current) {
        return;
      }

      if (detections.length === 1) {
        setStatus("Face detected. Registering automatically...");

        await handleRegister();

        return;
      }

      if (detections.length === 0) {
        setStatus(
          "Look at the camera. Your face will be registered automatically."
        );
      }

      if (detections.length > 1) {
        setStatus(
          "Only one face should be visible."
        );
      }

    } catch (error) {
      console.error(
        "AUTO FACE DETECTION ERROR:",
        error
      );
    }

    if (!cancelled && !autoCaptureRef.current) {
      setTimeout(autoDetect, 300);
    }
  };

  autoDetect();

  return () => {
    cancelled = true;
  };
}, [mode, cameraReady]);
useEffect(() => {
  if (mode !== "login" || !cameraReady) {
    return;
  }

  let cancelled = false;
  let timer = null;

  const autoVerify = async () => {
    if (cancelled || autoCaptureRef.current || processing) {
      return;
    }

    try {
      const key =
        `chainSentryFace:${email.trim().toLowerCase()}`;

      const saved = localStorage.getItem(key);

      if (!saved) {
        setStatus(
          "No face is registered for this email."
        );
        return;
      }

      const stored = JSON.parse(saved);
      const storedDescriptor =
        new Float32Array(stored.descriptor);

      const detections = await faceapi
        .detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5,
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (cancelled) return;

      if (detections.length === 0) {
        setStatus("Look at the camera.");
      } else if (detections.length > 1) {
        setStatus("Only one face should be visible.");
      } else {
        autoCaptureRef.current = true;
        setProcessing(true);

        setStatus("Face detected. Verifying automatically...");

        const distances = [];

        for (let i = 0; i < 3; i++) {
          if (cancelled) return;

          setStatus(
            `Verifying face ${i + 1} of 3...`
          );

          const detection = await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: 0.5,
              })
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            throw new Error(
              "Face moved. Please look at the camera."
            );
          }

          distances.push(
            faceapi.euclideanDistance(
              storedDescriptor,
              detection.descriptor
            )
          );

          if (i < 2) {
            await sleep(700);
          }
        }

        const matches = distances.filter(
          (distance) => distance <= 0.5
        ).length;

        console.log("Face distances:", distances);

        if (matches < 2) {
          throw new Error(
            "Face verification failed. Please try again."
          );
        }

        setStatus("Face verified successfully.");

        await sleep(500);

        onSuccess({
          type: "login",
        });
      }
    } catch (error) {
      console.error(
        "AUTOMATIC FACE LOGIN ERROR:",
        error
      );

      autoCaptureRef.current = false;
      setProcessing(false);

      setStatus(
        error.message ||
          "Face verification failed."
      );
    }
  };

  autoVerify();

  timer = setInterval(autoVerify, 500);

  return () => {
    cancelled = true;

    if (timer) {
      clearInterval(timer);
    }
  };
}, [mode, cameraReady]);
  const handleVerify = async () => {
    if (processing) return;

    try {
      const key = `chainSentryFace:${email.trim().toLowerCase()}`;
      const saved = localStorage.getItem(key);

      if (!saved) {
        throw new Error("No face is registered for this email. Register your face first.");
      }

      const stored = JSON.parse(saved);
      const storedDescriptor = new Float32Array(stored.descriptor);
      const distances = [];

      setProcessing(true);

      for (let i = 0; i < 3; i++) {
        setStatus(`Verifying face ${i + 1} of 3...`);

        const current = await detectFace();
        distances.push(
          faceapi.euclideanDistance(storedDescriptor, current)
        );

        await sleep(700);
      }

      const matches = distances.filter((distance) => distance <= 0.5).length;

      console.log("Face distances:", distances);

      if (matches < 2) {
        throw new Error("Face verification failed. Please try again.");
      }

      setStatus("Face verified successfully.");
      await sleep(500);
      onSuccess({ type: "login" });
    } catch (error) {
      console.error("FACE VERIFICATION ERROR:", error);
      setStatus(error.message || "Face verification failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="face-auth-overlay">
      <style>{`
        .face-auth-overlay { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(2,7,12,.88); backdrop-filter:blur(8px); }
        .face-auth-card { width:100%; max-width:540px; background:#0b1119; border:1px solid #1b2735; border-radius:14px; overflow:hidden; box-shadow:0 25px 80px rgba(0,0,0,.55); }
        .face-auth-header { display:flex; justify-content:space-between; align-items:flex-start; padding:20px 22px; border-bottom:1px solid #1b2735; }
        .face-auth-header h2 { margin:0; color:#e8ecf1; font-size:18px; }
        .face-auth-header p { margin:5px 0 0; color:#7f93ac; font-size:12px; }
        .face-auth-close { width:32px; height:32px; border:1px solid #263544; border-radius:7px; background:transparent; color:#7f93ac; font-size:20px; cursor:pointer; }
        .face-camera-wrap { position:relative; aspect-ratio:4/3; background:#02070c; overflow:hidden; }
        .face-camera { width:100%; height:100%; object-fit:cover; transform:scaleX(-1); display:block; }
        .face-frame { position:absolute; width:45%; height:62%; left:27.5%; top:19%; border:2px solid #22d3ee; border-radius:45%; pointer-events:none; box-shadow:0 0 0 9999px rgba(0,0,0,.12); }
        .face-camera-hint { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); padding:7px 12px; border-radius:6px; background:rgba(2,7,12,.78); color:#e8ecf1; font-size:11px; white-space:nowrap; }
        .face-auth-status { min-height:48px; display:flex; align-items:center; justify-content:center; padding:12px 20px; text-align:center; color:#a9b6c5; font-size:12px; }
        .face-auth-actions { display:flex; gap:10px; padding:0 20px 18px; }
        .face-auth-actions button { flex:1; }
        .face-auth-security { padding:12px 20px; border-top:1px solid #1b2735; text-align:center; color:#687b91; font-size:10px; }
      `}</style>

      <div className="face-auth-card">
        <div className="face-auth-header">
          <div>
            <h2>{mode === "register" ? "Register Your Face" : "Face Verification"}</h2>
            <p>{email}</p>
          </div>
          <button type="button" className="face-auth-close" onClick={onClose} disabled={processing}>×</button>
        </div>

        <div className="face-camera-wrap">
          <video ref={videoRef} autoPlay muted playsInline className="face-camera" />
          <div className="face-frame"></div>
          <div className="face-camera-hint">Keep only your face inside the frame</div>
        </div>

        <div className="face-auth-status">
          {cameraError || status}
        </div>

        <div className="face-auth-actions">
  <button
    type="button"
    className="register-hello-button"
    onClick={onClose}
    disabled={processing}
  >
    Cancel
  </button>
</div>

        <div className="face-auth-security">
          Face matching is processed in the browser for this demo.
        </div>
      </div>
    </div>
  );
}

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);
  const [helloLoading, setHelloLoading] = useState(false);
  const [faceMode, setFaceMode] = useState(null);
  const [signupStep, setSignupStep] = useState(null);
  /*
  ============================================================
  FIREBASE EMAIL/PASSWORD LOGIN
  ============================================================
  */

  const handleSubmit = async (e) => {
  e.preventDefault();

  setError("");

  if (!email.trim()) {
    setError("Please enter your email.");
    return;
  }

  try {
    setHelloLoading(true);

    const userEmail = email.trim().toLowerCase();

    // 1. Get Windows Hello authentication options
    const optionsResponse = await fetch(
      `${API_BASE_URL}/webauthn/login/options`,
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

    const optionsData = await optionsResponse.json();

    if (!optionsResponse.ok) {
      throw new Error(
        optionsData.error ||
        "Fingerprint authentication is not registered."
      );
    }

    // 2. Windows Hello / fingerprint
    const authenticationResponse =
      await startAuthentication({
        optionsJSON: optionsData,
      });

    // 3. Verify fingerprint
    const verifyResponse = await fetch(
      `${API_BASE_URL}/webauthn/login/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          response: authenticationResponse,
        }),
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyData.verified) {
      throw new Error(
        verifyData.error ||
        "Fingerprint authentication failed."
      );
    }

    // 4. Fingerprint successful → automatically open face
    setHelloLoading(false);
    setFaceMode("login");

  } catch (error) {
    console.error("BIOMETRIC LOGIN ERROR:", error);

    setHelloLoading(false);

    if (error.name === "NotAllowedError") {
      setError(
        "Fingerprint authentication was cancelled or not completed."
      );
    } else {
      setError(
        error.message ||
        "Biometric authentication failed."
      );
    }
  }
};
  /*
  ============================================================
  WINDOWS HELLO LOGIN
  ============================================================
  */

  const handleWindowsHello = async () => {
    setError("");

    if (!email) {
      setError(
        "Enter your email first, then use Windows Hello."
      );
      return;
    }

    try {
      setHelloLoading(true);

      const userEmail =
        email.trim().toLowerCase();

      console.log(
        "Requesting Windows Hello authentication options..."
      );

      const optionsResponse = await fetch(
        `${API_BASE_URL}/webauthn/login/options`,
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

      console.log(
        "Authentication options:",
        optionsResponse.status,
        optionsText
      );

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
            "Windows Hello credential is not registered."
        );
      }

      /*
       * Start Windows Hello
       */

      const authenticationResponse =
        await startAuthentication({
          optionsJSON: optionsData,
        });

      console.log(
        "Windows Hello authentication response received."
      );

      /*
       * Verify authentication
       */

      const verifyResponse = await fetch(
        `${API_BASE_URL}/webauthn/login/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: userEmail,
            response: authenticationResponse,
          }),
        }
      );

      const verifyText =
        await verifyResponse.text();

      console.log(
        "Authentication verification:",
        verifyResponse.status,
        verifyText
      );

      let verifyData;

      try {
        verifyData = JSON.parse(verifyText);
      } catch {
        throw new Error(
          `Backend verification returned an invalid response (${verifyResponse.status}).`
        );
      }

      if (
        !verifyResponse.ok ||
        !verifyData.verified
      ) {
        throw new Error(
          verifyData.error ||
            "Windows Hello authentication failed."
        );
      }

      /*
       * Login successful
       */

      localStorage.setItem(
        "authenticated",
        "true"
      );

      navigate("/dashboard");
    } catch (error) {
      console.error(
        "WINDOWS HELLO LOGIN ERROR:",
        error
      );

      if (
        error.name === "NotAllowedError"
      ) {
        setError(
          "Windows Hello authentication was cancelled or not completed."
        );
      } else if (
        error.message === "Failed to fetch"
      ) {
        setError(
          "Cannot connect to the Chain Sentry backend. Make sure the backend is running on port 5001."
        );
      } else {
        setError(
          error.message ||
            "Windows Hello authentication failed."
        );
      }
    } finally {
      setHelloLoading(false);
    }
  };

  /*
  ============================================================
  WINDOWS HELLO REGISTRATION
  ============================================================
  */

 const handleRegisterWindowsHello = async () => {
  setError("");

  if (!email.trim()) {
    setError(
      "Enter your email first, then register fingerprint or Windows Hello."
    );
    return;
  }

  try {
    setHelloLoading(true);

    const userEmail = email.trim().toLowerCase();

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

    const optionsText = await optionsResponse.text();

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
          "Unable to create fingerprint registration options."
      );
    }

    /*
     * Start fingerprint / Windows Hello registration
     */
    const registrationResponse = await startRegistration({
      optionsJSON: optionsData,
    });

    /*
     * Verify registration
     */
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

    const verifyText = await verifyResponse.text();

    let verifyData;

    try {
      verifyData = JSON.parse(verifyText);
    } catch {
      throw new Error(
        `Backend verification returned an invalid response (${verifyResponse.status}).`
      );
    }

    if (!verifyResponse.ok || !verifyData.verified) {
      throw new Error(
        verifyData.error ||
          "Fingerprint / Windows Hello registration failed."
      );
    }

    /*
     * Fingerprint registration completed.
     * Now move directly to face registration.
     */
    setError("");
    setSignupStep("face");

    setFaceMode("register");
  } catch (error) {
    console.error(
      "FINGERPRINT REGISTRATION ERROR:",
      error
    );

    if (error.name === "NotAllowedError") {
      setError(
        "Fingerprint / Windows Hello registration was cancelled or not completed."
      );
    } else if (error.message === "Failed to fetch") {
      setError(
        "Cannot connect to the Chain Sentry backend. Make sure the backend is running on port 5001."
      );
    } else if (error.name === "InvalidStateError") {
      setError(
        "This device already has a TraceX passkey, but the server did not confirm it for this account. Remove the existing TraceX passkey from your device's passkey settings, then register again."
      );
    } else {
      setError(
        error.message ||
          "Fingerprint / Windows Hello registration failed."
      );
    }
  } finally {
    setHelloLoading(false);
  }
};

  /*
  ============================================================
  LOGIN UI
  ============================================================
  */
const handleFaceSuccess = (result) => {
  setFaceMode(null);

  if (result.type === "register") {
    setError("");

    if (signupStep === "face") {
      setSignupStep(null);

      alert(
        "Registration completed successfully!\n\nFingerprint and Face Recognition have both been registered."
      );

      return;
    }

    alert(
      "Face registered successfully for this email."
    );

    return;
  }

  if (result.type === "login") {
    localStorage.setItem(
      "authenticated",
      "true"
    );

    navigate("/dashboard");
  }
};

const handleFaceClose = () => {
  setFaceMode(null);
};
  return (
    <div className="login-page">

      <div className="login-background-grid"></div>

      <div className="login-container">

        {/* Logo / Brand */}

        <div className="login-brand">
          <div className="login-logo">
            CS
          </div>

          <div>
            <h1>Chain Sentry</h1>

            <p>
              Crypto Fraud Investigation Suite
            </p>
          </div>
        </div>

        {/* Login Card */}

        <div className="login-card">

          <div className="login-card-header">
            <h2>Secure Login</h2>

            <p>
              Access the Chain Sentry investigation platform
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="login-form"
          >

            {/* Email */}

            <div className="login-field">

              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="investigator@example.com"
                autoComplete="email"
                disabled={
                  loading || helloLoading || !!faceMode
                }
              />

            </div>

            {/* Password */}

            <div className="login-field">

              <div className="login-label-row">

                <label htmlFor="password">
                  Password
                </label>

                <span>
                  Secure access
                </span>

              </div>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={
                  loading || helloLoading || !!faceMode
                }
              />

            </div>

            {/* Error */}

            {error && (
              <div className="login-error">
                <span className="login-error-icon">
                  !
                </span>

                <span>{error}</span>
              </div>
            )}

            {/* Firebase Login */}

            <button
              type="submit"
              className="login-primary-button"
              disabled={
                loading || helloLoading || !!faceMode
              }
            >

              {loading ? (
                <>
                  <span className="login-spinner"></span>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <span>→</span>
                </>
              )}

            </button>

          </form>

          {/* Divider */}

          <div className="login-divider">
            <span></span>
            <p>OR</p>
            <span></span>
          </div>

        

         
          {/* Register */}

          <button
  type="button"
  className="register-hello-button"
  onClick={handleRegisterWindowsHello}
  disabled={
    loading || helloLoading || !!faceMode
  }
>
  {helloLoading ? (
    <>
      <span className="login-spinner"></span>
      Registering Fingerprint...
    </>
  ) : (
    "Sign Up — Fingerprint & Face"
  )}
</button>

          {/* Security information */}

          <div className="login-security">

            <span className="security-dot"></span>

            <span>
              Protected with secure authentication
            </span>

          </div>

        </div>

        {/* Footer */}

        <div className="login-footer">

          <span>
            Chain Sentry
          </span>

          <span>•</span>

          <span>
            Blockchain Intelligence Platform
          </span>

        </div>

        {faceMode && (
          <FaceRecognition
            email={email.trim().toLowerCase()}
            mode={faceMode}
            onSuccess={handleFaceSuccess}
            onClose={handleFaceClose}
          />
        )}

      </div>
    </div>
  );
}

export default Login;
