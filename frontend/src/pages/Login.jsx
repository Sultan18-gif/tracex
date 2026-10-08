import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { startAuthentication } from "@simplewebauthn/browser";

import { auth } from "../firebase";
import { API_BASE_URL } from "../api";

import * as faceapi from "@vladmandic/face-api";

import "../styles/theme.css";

/* =========================================================
   FACE API CONFIGURATION
   ========================================================= */

const FACE_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model";

let faceModelsLoaded = false;
let faceModelsPromise = null;

/* =========================================================
   LOAD FACE MODELS
   ========================================================= */

async function loadFaceModels() {
  if (faceModelsLoaded) {
    return;
  }

  if (faceModelsPromise) {
    return faceModelsPromise;
  }

  faceModelsPromise = (async () => {
    await faceapi.nets.tinyFaceDetector.loadFromUri(
      FACE_MODEL_URL
    );

    await faceapi.nets.faceLandmark68Net.loadFromUri(
      FACE_MODEL_URL
    );

    await faceapi.nets.faceRecognitionNet.loadFromUri(
      FACE_MODEL_URL
    );

    faceModelsLoaded = true;
  })();

  try {
    await faceModelsPromise;
  } catch (error) {
    faceModelsPromise = null;
    faceModelsLoaded = false;
    throw error;
  }
}


/* =========================================================
   FACE STORAGE
   ========================================================= */

function getFaceStorageKey(email) {
  return `chainSentryFace:${email
    .trim()
    .toLowerCase()}`;
}


/* =========================================================
   DESCRIPTOR VALIDATION
   ========================================================= */

function isValidFaceDescriptor(value) {
  if (!value) {
    return false;
  }

  if (
    !(Array.isArray(value) ||
      value instanceof Float32Array)
  ) {
    return false;
  }

  if (value.length !== 128) {
    return false;
  }

  return Array.from(value).every(
    (number) =>
      typeof number === "number" &&
      Number.isFinite(number)
  );
}


/* =========================================================
   AVERAGE FACE DESCRIPTORS
   ========================================================= */

function averageDescriptors(descriptors) {
  const validDescriptors = descriptors.filter(
    isValidFaceDescriptor
  );

  if (validDescriptors.length === 0) {
    throw new Error(
      "No valid face descriptors were captured."
    );
  }

  const result = new Float32Array(128);

  for (let i = 0; i < 128; i++) {
    let total = 0;

    for (const descriptor of validDescriptors) {
      total += Number(descriptor[i]);
    }

    result[i] =
      total / validDescriptors.length;
  }

  return result;
}


/* =========================================================
   SAVE FACE PROFILE
   ========================================================= */

function saveFaceDescriptor(email, descriptor) {
  if (!isValidFaceDescriptor(descriptor)) {
    throw new Error(
      "The captured face profile is invalid."
    );
  }

  const key = getFaceStorageKey(email);

  const profile = {
    version: 1,
    descriptor: Array.from(descriptor),
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(
    key,
    JSON.stringify(profile)
  );

  console.log(
    "FACE PROFILE SAVED:",
    key
  );

  console.log(
    "FACE DESCRIPTOR LENGTH:",
    descriptor.length
  );
}


/* =========================================================
   LOAD FACE PROFILE
   ========================================================= */

function loadSavedFaceDescriptor(email) {
  const key = getFaceStorageKey(email);

  const raw = localStorage.getItem(key);

  if (!raw) {
    throw new Error(
      "No face profile is registered for this email. Please register your face first."
    );
  }

  let saved;

  try {
    saved = JSON.parse(raw);
  } catch (error) {
    console.error(
      "FACE PROFILE JSON ERROR:",
      error
    );

    localStorage.removeItem(key);

    throw new Error(
      "Saved face profile is corrupted. Please register your face again."
    );
  }


  /* -------------------------------------------------------
     FORMAT 1

     Direct array:
     [0.12, -0.23, ...]
     ------------------------------------------------------- */

  if (isValidFaceDescriptor(saved)) {
    return new Float32Array(saved);
  }


  /* -------------------------------------------------------
     FORMAT 2

     {
       descriptor: [...]
     }
     ------------------------------------------------------- */

  if (
    saved &&
    isValidFaceDescriptor(saved.descriptor)
  ) {
    return new Float32Array(
      saved.descriptor
    );
  }


  /* -------------------------------------------------------
     FORMAT 3

     {
       descriptors: [
         [...],
         [...],
         [...]
       ]
     }
     ------------------------------------------------------- */

  if (
    saved &&
    Array.isArray(saved.descriptors)
  ) {
    const validDescriptors =
      saved.descriptors.filter(
        isValidFaceDescriptor
      );

    if (validDescriptors.length > 0) {
      const averaged =
        averageDescriptors(
          validDescriptors
        );

      if (
        isValidFaceDescriptor(averaged)
      ) {
        return averaged;
      }
    }
  }


  /* -------------------------------------------------------
     FORMAT 4

     {
       faceDescriptor: [...]
     }
     ------------------------------------------------------- */

  if (
    saved &&
    isValidFaceDescriptor(
      saved.faceDescriptor
    )
  ) {
    return new Float32Array(
      saved.faceDescriptor
    );
  }


  /*
   * Invalid old profile.
   */

  localStorage.removeItem(key);

  throw new Error(
    "Saved face profile is empty or invalid. Please register your face again."
  );
}


/* =========================================================
   FACE RECOGNITION COMPONENT
   ========================================================= */

export function FaceRecognition({
  email,
  mode,
  onSuccess,
  onClose,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const cancelledRef = useRef(false);
  const processingRef = useRef(false);

  const [cameraReady, setCameraReady] =
    useState(false);

  const [modelsReady, setModelsReady] =
    useState(false);

  const [processing, setProcessing] =
    useState(false);

  const [status, setStatus] =
    useState("Preparing face recognition...");

  const [error, setError] =
    useState("");

  const [capturedDescriptors, setCapturedDescriptors] =
    useState([]);


  /* =======================================================
     START CAMERA
     ======================================================= */

  useEffect(() => {
    cancelledRef.current = false;

    let mounted = true;

    const startCamera = async () => {
      try {
        setError("");
        setStatus(
          "Loading face recognition models..."
        );

        await loadFaceModels();

        if (!mounted) {
          return;
        }

        setModelsReady(true);

        setStatus(
          "Requesting camera access..."
        );

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode: "user",
                width: {
                  ideal: 640,
                },
                height: {
                  ideal: 480,
                },
              },
              audio: false,
            }
          );

        if (!mounted) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject =
            stream;

          await videoRef.current.play();

          setCameraReady(true);

          setStatus(
            mode === "register"
              ? "Position your face inside the guide."
              : "Looking for your face..."
          );
        }
      } catch (cameraError) {
        console.error(
          "FACE CAMERA ERROR:",
          cameraError
        );

        if (!mounted) {
          return;
        }

        if (
          cameraError?.name ===
          "NotAllowedError"
        ) {
          setError(
            "Camera permission was denied. Please allow camera access and try again."
          );
        } else if (
          cameraError?.name ===
          "NotFoundError"
        ) {
          setError(
            "No camera was found on this device."
          );
        } else {
          setError(
            cameraError?.message ||
              "Unable to start face recognition."
          );
        }

        setStatus(
          "Face recognition could not start."
        );
      }
    };

    startCamera();

    return () => {
      mounted = false;
      cancelledRef.current = true;

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [mode]);


  /* =======================================================
     REGISTER FACE
     Automatically captures 3 good samples.
     ======================================================= */

  useEffect(() => {
    if (
      mode !== "register" ||
      !cameraReady ||
      !modelsReady
    ) {
      return;
    }

    let cancelled = false;
    let timer = null;

    const captureFace = async () => {
      if (
        cancelled ||
        cancelledRef.current ||
        processingRef.current
      ) {
        return;
      }

      if (!videoRef.current) {
        return;
      }

      if (
        videoRef.current.readyState < 2
      ) {
        return;
      }

      try {
        const detection =
          await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions(
                {
                  inputSize: 320,
                  scoreThreshold: 0.5,
                }
              )
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (cancelled) {
          return;
        }

        if (!detection) {
          setStatus(
            "Position your face inside the guide."
          );

          timer = setTimeout(
            captureFace,
            700
          );

          return;
        }

        if (!detection.descriptor) {
          setStatus(
            "Unable to read your face. Please try again."
          );

          timer = setTimeout(
            captureFace,
            700
          );

          return;
        }

        const descriptor =
          Array.from(
            detection.descriptor
          );

        setCapturedDescriptors(
          (previous) => {
            const updated = [
              ...previous,
              descriptor,
            ];

            const sampleNumber =
              Math.min(
                updated.length,
                3
              );

            setStatus(
              `Capturing face sample ${sampleNumber} of 3...`
            );

            if (
              updated.length >= 3
            ) {
              processingRef.current = true;
              setProcessing(true);

              try {
                const averaged =
                  averageDescriptors(
                    updated
                  );

                saveFaceDescriptor(
                  email,
                  averaged
                );

                setStatus(
                  "Face registered successfully."
                );

                setTimeout(() => {
                  if (
                    !cancelled &&
                    !cancelledRef.current
                  ) {
                    onSuccess?.({
                      type: "register",
                      descriptor:
                        Array.from(
                          averaged
                        ),
                    });
                  }
                }, 700);
              } catch (registrationError) {
                console.error(
                  "FACE REGISTRATION ERROR:",
                  registrationError
                );

                processingRef.current =
                  false;

                setProcessing(false);

                setError(
                  registrationError
                    ?.message ||
                    "Face registration failed."
                );
              }

              return updated;
            }

            return updated;
          }
        );

        /*
         * Give the camera a short moment before
         * capturing the next sample.
         */

        if (
          !processingRef.current
        ) {
          timer = setTimeout(
            captureFace,
            850
          );
        }
      } catch (captureError) {
        console.error(
          "FACE CAPTURE ERROR:",
          captureError
        );

        if (!cancelled) {
          setStatus(
            "Face detection failed. Please keep your face visible."
          );

          timer = setTimeout(
            captureFace,
            800
          );
        }
      }
    };

    captureFace();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    mode,
    cameraReady,
    modelsReady,
    email,
    onSuccess,
  ]);


  /* =======================================================
     AUTOMATIC FACE LOGIN
     ======================================================= */

  useEffect(() => {
    if (
      mode !== "login" ||
      !cameraReady ||
      !modelsReady
    ) {
      return;
    }

    let cancelled = false;
    let timer = null;

    const autoVerify = async () => {
      if (
        cancelled ||
        cancelledRef.current ||
        processingRef.current
      ) {
        return;
      }

      if (!videoRef.current) {
        return;
      }

      if (
        videoRef.current.readyState < 2
      ) {
        timer = setTimeout(
          autoVerify,
          700
        );

        return;
      }

      try {
        /*
         * Load and validate the stored face profile.
         */

        const savedDescriptor =
          loadSavedFaceDescriptor(
            email
          );

        if (
          !isValidFaceDescriptor(
            savedDescriptor
          )
        ) {
          throw new Error(
            "Saved face profile is invalid. Please register your face again."
          );
        }

        setStatus(
          "Looking for your face..."
        );

        const detection =
          await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions(
                {
                  inputSize: 320,
                  scoreThreshold: 0.5,
                }
              )
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (
          cancelled ||
          cancelledRef.current
        ) {
          return;
        }

        if (!detection) {
          setStatus(
            "Position your face inside the guide."
          );

          timer = setTimeout(
            autoVerify,
            600
          );

          return;
        }

        if (!detection.descriptor) {
          setStatus(
            "Unable to read your face."
          );

          timer = setTimeout(
            autoVerify,
            700
          );

          return;
        }

        /*
         * Compare saved descriptor with
         * the live camera descriptor.
         */

        const distance =
          faceapi.euclideanDistance(
            savedDescriptor,
            detection.descriptor
          );

        console.log(
          "FACE MATCH DISTANCE:",
          distance
        );

        /*
         * Lower distance = stronger match.
         *
         * 0.50 is a reasonable starting point.
         */

        if (distance > 0.5) {
          setStatus(
            "Face does not match. Look directly at the camera."
          );

          timer = setTimeout(
            autoVerify,
            800
          );

          return;
        }

        /*
         * FACE VERIFIED
         */

        processingRef.current = true;

        setProcessing(true);

        setStatus(
          "Face verified successfully."
        );

        console.log(
          "FACE LOGIN SUCCESSFUL"
        );

        await new Promise(
          (resolve) =>
            setTimeout(resolve, 600)
        );

        if (
          !cancelled &&
          !cancelledRef.current
        ) {
          onSuccess?.({
            type: "login",
            distance,
          });
        }
      } catch (verificationError) {
        console.error(
          "AUTOMATIC FACE LOGIN ERROR:",
          verificationError
        );

        processingRef.current = false;
        setProcessing(false);

        /*
         * If there is no valid profile, don't
         * continuously throw the same error.
         */

        if (
          verificationError?.message?.includes(
            "No face profile"
          ) ||
          verificationError?.message?.includes(
            "Saved face profile"
          )
        ) {
          setError(
            verificationError.message
          );

          setStatus(
            "Face registration is required."
          );

          return;
        }

        setStatus(
          verificationError?.message ||
            "Face verification failed. Please try again."
        );

        timer = setTimeout(
          autoVerify,
          1000
        );
      }
    };

    autoVerify();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [
    mode,
    cameraReady,
    modelsReady,
    email,
    onSuccess,
  ]);


  /* =======================================================
     CLOSE
     ======================================================= */

  const handleClose = () => {
    cancelledRef.current = true;

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;
    }

    onClose?.();
  };


  /* =======================================================
     UI
     ======================================================= */

  return (
    <div className="face-auth-overlay">
      <div className="face-auth-card">

        {/* HEADER */}

        <div className="face-auth-header">
          <div>
            <h2>
              {mode === "register"
                ? "Register Face"
                : "Face Verification"}
            </h2>

            <p>
              {mode === "register"
                ? "Secure your TraceX account with face recognition."
                : "Verify your identity to continue."}
            </p>
          </div>

          <button
            type="button"
            className="face-auth-close"
            onClick={handleClose}
            disabled={processing}
          >
            ×
          </button>
        </div>


        {/* CAMERA */}

        <div className="face-camera-container">
          <video
            ref={videoRef}
            className="face-camera"
            autoPlay
            muted
            playsInline
          />

          <div className="face-guide">

            <div className="face-guide-corner top-left" />

            <div className="face-guide-corner top-right" />

            <div className="face-guide-corner bottom-left" />

            <div className="face-guide-corner bottom-right" />

            <div className="face-guide-text">
              {mode === "register"
                ? "Keep your face centered"
                : "Look directly at the camera"}
            </div>

          </div>
        </div>


        {/* STATUS */}

        <div className="face-auth-status">
          {status}
        </div>


        {/* ERROR */}

        {error && (
          <div className="login-error face-auth-error">
            <div className="login-error-icon">
              !
            </div>

            <div>
              {error}
            </div>
          </div>
        )}


        {/* ACTIONS */}

        <div className="face-auth-actions">

          <button
            type="button"
            className="register-hello-button"
            onClick={handleClose}
            disabled={processing}
          >
            Cancel
          </button>

        </div>


        {/* SECURITY */}

        <div className="face-auth-security">
          <span className="security-dot" />

          Face data is processed locally on this device.
        </div>

      </div>
    </div>
  );
}


/* =========================================================
   LOGIN COMPONENT
   ========================================================= */

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [helloLoading, setHelloLoading] =
    useState(false);

  const [faceMode, setFaceMode] =
    useState(null);

  const [biometricStep, setBiometricStep] =
    useState(null);


  /* =======================================================
     FINISH LOGIN
     ======================================================= */

  const finishLogin = () => {
    localStorage.setItem(
      "authenticated",
      "true"
    );

    navigate("/dashboard");
  };


  /* =======================================================
     WINDOWS HELLO LOGIN
     ======================================================= */

  const handleWindowsHelloLogin =
    async () => {
      setError("");

      const userEmail =
        email.trim().toLowerCase();

      if (!userEmail) {
        setError(
          "Please enter your email address first."
        );

        return false;
      }

      try {
        setHelloLoading(true);

        setBiometricStep(
          "windows-hello"
        );

        console.log(
          "Starting Windows Hello authentication..."
        );


        /* ---------------------------------------------------
           GET AUTHENTICATION OPTIONS
           --------------------------------------------------- */

        const optionsResponse =
          await fetch(
            `${API_BASE_URL}/webauthn/login/options`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
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
          optionsData =
            JSON.parse(optionsText);
        } catch {
          throw new Error(
            `Backend returned an invalid Windows Hello response (${optionsResponse.status}).`
          );
        }


        if (!optionsResponse.ok) {
          throw new Error(
            optionsData?.error ||
              "Windows Hello credential is not registered."
          );
        }


        /* ---------------------------------------------------
           WINDOWS HELLO / FINGERPRINT PROMPT
           --------------------------------------------------- */

        const authenticationResponse =
          await startAuthentication({
            optionsJSON: optionsData,
          });


        /* ---------------------------------------------------
           VERIFY AUTHENTICATION
           --------------------------------------------------- */

        const verifyResponse =
          await fetch(
            `${API_BASE_URL}/webauthn/login/verify`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                email: userEmail,

                response:
                  authenticationResponse,
              }),
            }
          );


        const verifyText =
          await verifyResponse.text();

        let verifyData;

        try {
          verifyData =
            JSON.parse(verifyText);
        } catch {
          throw new Error(
            `Backend verification returned an invalid response (${verifyResponse.status}).`
          );
        }


        if (
          !verifyResponse.ok ||
          !verifyData?.verified
        ) {
          throw new Error(
            verifyData?.error ||
              "Windows Hello authentication failed."
          );
        }


        console.log(
          "Windows Hello authentication successful."
        );

        console.log(
          "Windows Hello verified."
        );

        return true;
      } catch (helloError) {
        console.error(
          "WINDOWS HELLO LOGIN ERROR:",
          helloError
        );


        if (
          helloError?.name ===
          "NotAllowedError"
        ) {
          setError(
            "Windows Hello was cancelled or unavailable. Face verification will be attempted."
          );
        } else if (
          helloError?.message ===
          "Failed to fetch"
        ) {
          setError(
            "Unable to connect to the TraceX backend. Face verification will be attempted."
          );
        } else {
          /*
           * We don't stop the entire login process here.
           *
           * The next step is automatic face verification.
           */

          console.warn(
            "Windows Hello unavailable. Continuing with face verification."
          );
        }

        return false;
      } finally {
        setHelloLoading(false);
      }
    };


  /* =======================================================
     MAIN SIGN IN
     ======================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    const userEmail =
      email.trim().toLowerCase();


    /* -------------------------------------------------------
       VALIDATION
       ------------------------------------------------------- */

    if (!userEmail) {
      setError(
        "Please enter your email address."
      );

      return;
    }

    if (!password) {
      setError(
        "Please enter your password."
      );

      return;
    }


    try {
      setLoading(true);

      setBiometricStep(null);


      /* -----------------------------------------------------
         FIREBASE EMAIL + PASSWORD
         ----------------------------------------------------- */

      console.log(
        "Starting Firebase authentication..."
      );

      await signInWithEmailAndPassword(
        auth,
        userEmail,
        password
      );

      console.log(
        "Firebase authentication successful."
      );


      setLoading(false);


      /* -----------------------------------------------------
         WINDOWS HELLO
         ----------------------------------------------------- */

      const helloVerified =
        await handleWindowsHelloLogin();


      if (helloVerified) {
        console.log(
          "Windows Hello verified."
        );
      }


      /* -----------------------------------------------------
         FACE VERIFICATION
         ----------------------------------------------------- */

      console.log(
        "Starting automatic face verification..."
      );

      setBiometricStep("face");

      setError("");

      setFaceMode("login");

    } catch (loginError) {
      console.error(
        "LOGIN ERROR:",
        loginError
      );


      /* -----------------------------------------------------
         FIREBASE ERRORS
         ----------------------------------------------------- */

      if (
        loginError?.code ===
        "auth/invalid-credential"
      ) {
        setError(
          "Invalid email or password."
        );
      } else if (
        loginError?.code ===
        "auth/invalid-email"
      ) {
        setError(
          "Please enter a valid email address."
        );
      } else if (
        loginError?.code ===
        "auth/user-not-found"
      ) {
        setError(
          "No account was found with this email."
        );
      } else if (
        loginError?.code ===
        "auth/wrong-password"
      ) {
        setError(
          "Incorrect password."
        );
      } else if (
        loginError?.code ===
        "auth/network-request-failed"
      ) {
        setError(
          "Unable to reach Firebase. Check your internet connection and try again."
        );
      } else if (
        loginError?.code ===
        "auth/too-many-requests"
      ) {
        setError(
          "Too many login attempts. Please wait and try again."
        );
      } else {
        setError(
          loginError?.message ||
            "Login failed. Please try again."
        );
      }

    } finally {
      setLoading(false);
    }
  };


  /* =======================================================
     FACE SUCCESS
     ======================================================= */

  const handleFaceSuccess =
    async (result) => {
      console.log(
        "FACE VERIFICATION RESULT:",
        result
      );

      if (
        !result ||
        result.type !== "login"
      ) {
        return;
      }

      console.log(
        "Face verification successful."
      );


      setFaceMode(null);

      setBiometricStep(null);

      setError("");

      finishLogin();
    };


  /* =======================================================
     FACE CLOSE
     ======================================================= */

  const handleFaceClose =
    async () => {
      console.log(
        "Face verification cancelled."
      );

      setFaceMode(null);

      setBiometricStep(null);

      /*
       * The password may already have authenticated
       * Firebase. Since biometric verification wasn't
       * completed, sign the Firebase session back out.
       */

      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error(
          "SIGN OUT ERROR:",
          signOutError
        );
      }

      localStorage.removeItem(
        "authenticated"
      );

      setError(
        "Biometric verification was cancelled. Please sign in again."
      );
    };


  /* =======================================================
     CREATE ACCOUNT
     ======================================================= */

  const handleCreateAccount =
    () => {
      navigate("/signup");
    };


  /* =======================================================
     UI
     ======================================================= */

  return (
    <div
      className={
        "login-page cs-login-screen"
      }
    >

      {/* ===================================================
          BACKGROUND
          =================================================== */}

      <div className="login-background-grid" />


      {/* ===================================================
          MAIN CONTAINER
          =================================================== */}

      <div className="login-container">

        {/* =================================================
            BRAND
            ================================================= */}

        <div className="login-brand cs-login-brand">

          <div className="login-logo cs-login-icon">
            T
          </div>

          <h1>
            TraceX
          </h1>

          <p>
            Crypto Fraud Investigation Suite
          </p>

        </div>


        {/* =================================================
            LOGIN CARD
            ================================================= */}

        <div className="login-card cs-login-card">

          <div className="cs-login-bar" />


          {/* =================================================
              CARD HEADER
              ================================================= */}

          <div className="login-card-header">

            <h2>
              Welcome Back
            </h2>

            <p>
              Sign in to continue to your
              cryptocurrency investigation
              dashboard.
            </p>

          </div>


          {/* =================================================
              FORM
              ================================================= */}

          <form
            className="login-form cs-login-form"
            onSubmit={handleSubmit}
          >

            {/* ===============================================
                EMAIL
                =============================================== */}

            <div className="login-field form-group">

              <label htmlFor="login-email">
                Email Address
              </label>

              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="investigator@example.com"
                autoComplete="email"
                disabled={
                  loading ||
                  helloLoading ||
                  !!faceMode
                }
              />

            </div>


            {/* ===============================================
                PASSWORD
                =============================================== */}

            <div className="login-field form-group">

              <label htmlFor="login-password">
                Password
              </label>

              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={
                  loading ||
                  helloLoading ||
                  !!faceMode
                }
              />

            </div>


            {/* ===============================================
                ERROR
                =============================================== */}

            {error && (
              <div className="login-error cs-login-error">

                <div className="login-error-icon">
                  !
                </div>

                <div>
                  {error}
                </div>

              </div>
            )}


            {/* ===============================================
                SIGN IN
                =============================================== */}

            <button
              type="submit"
              className="login-primary-button cs-login-submit"
              disabled={
                loading ||
                helloLoading ||
                !!faceMode
              }
            >

              {(loading ||
                helloLoading) && (
                <span className="login-spinner" />
              )}

              {loading
                ? "Signing In..."
                : helloLoading
                ? "Waiting for Windows Hello..."
                : "Sign In"}

            </button>

          </form>


          {/* =================================================
              DIVIDER
              ================================================= */}

          <div className="login-divider">

            <span />

            <p>
              OR
            </p>

            <span />

          </div>


          {/* =================================================
              CREATE ACCOUNT
              ================================================= */}

          <button
            type="button"
            className="login-secondary-button"
            onClick={
              handleCreateAccount
            }
            disabled={
              loading ||
              helloLoading ||
              !!faceMode
            }
          >
            Create New Account
          </button>


          {/* =================================================
              BIOMETRIC STATUS
              ================================================= */}

          {biometricStep && (
            <div className="login-security-info">

              <div className="security-icon">
                {biometricStep ===
                "windows-hello"
                  ? "◉"
                  : "◌"}
              </div>

              <div>

                <strong>
                  {biometricStep ===
                  "windows-hello"
                    ? "Windows Hello / Fingerprint"
                    : "Face Verification"}
                </strong>

                <span>
                  {biometricStep ===
                  "windows-hello"
                    ? "Verify your identity using your registered Windows Hello credential."
                    : "Look directly at the camera to complete authentication."}
                </span>

              </div>

            </div>
          )}


          {/* =================================================
              SECURITY FOOTER
              ================================================= */}

          {!biometricStep && (
            <div className="login-security-info">

              <div className="security-icon">
                🔒
              </div>

              <div>

                <strong>
                  Multi-Layer Security
                </strong>

                <span>
                  Password + Windows Hello / fingerprint + face verification
                </span>

              </div>

            </div>
          )}

        </div>


        {/* =================================================
            FOOTER
            ================================================= */}

        <div className="login-footer cs-login-footer">

          <span>
            TraceX
          </span>

          <span>
            •
          </span>

          <span>
            Blockchain Intelligence Platform
          </span>

        </div>

      </div>


      {/* ===================================================
          AUTOMATIC FACE AUTHENTICATION
          =================================================== */}

      {faceMode === "login" && (
        <FaceRecognition
          email={email}
          mode="login"
          onSuccess={
            handleFaceSuccess
          }
          onClose={
            handleFaceClose
          }
        />
      )}

    </div>
  );
}