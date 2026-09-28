import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";

let modelsLoaded = false;
let modelsLoadingPromise = null;

const MODEL_URL = "/models";

async function loadFaceModels() {
  if (modelsLoaded) return;

  if (!modelsLoadingPromise) {
    modelsLoadingPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  }

  await modelsLoadingPromise;
  modelsLoaded = true;
}

function averageDescriptors(descriptors) {
  if (!descriptors.length) return null;

  const length = descriptors[0].length;
  const result = new Array(length).fill(0);

  for (const descriptor of descriptors) {
    for (let i = 0; i < length; i++) {
      result[i] += descriptor[i];
    }
  }

  for (let i = 0; i < length; i++) {
    result[i] /= descriptors.length;
  }

  return result;
}

function FaceRecognition({
  email,
  mode,
  onSuccess,
  onClose,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const processingRef = useRef(false);

  const [status, setStatus] = useState("Loading face recognition...");
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        setStatus("Loading face recognition models...");

        await loadFaceModels();

        if (!mounted) return;

        setStatus("Requesting camera permission...");

        const stream = await navigator.mediaDevices.getUserMedia({
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
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;

        if (video) {
          video.srcObject = stream;

          await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
          });

          await video.play();

          setCameraReady(true);
          setStatus(
            mode === "register"
              ? "Position your face inside the frame and click Register Face."
              : "Position your face inside the frame and click Verify Face."
          );
        }
      } catch (error) {
        console.error("FACE CAMERA ERROR:", error);

        if (error.name === "NotAllowedError") {
          setCameraError(
            "Camera permission was denied. Please allow camera access in your browser."
          );
        } else if (error.name === "NotFoundError") {
          setCameraError(
            "No camera was found. Connect a webcam and try again."
          );
        } else {
          setCameraError(
            error.message || "Unable to start face recognition."
          );
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, [mode]);

  const detectFace = async () => {
    const video = videoRef.current;

    if (!video || !cameraReady) {
      throw new Error("Camera is not ready.");
    }

    const detections = await faceapi
      .detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      throw new Error(
        "No face detected. Move closer and look directly at the camera."
      );
    }

    if (detections.length > 1) {
      throw new Error(
        "Multiple faces detected. Only one person should be visible."
      );
    }

    const detection = detections[0];

    if (detection.detection.score < 0.65) {
      throw new Error(
        "Face detection confidence is too low. Move closer and improve lighting."
      );
    }

    return detection.descriptor;
  };

  const wait = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  const handleRegister = async () => {
    if (processingRef.current) return;

    if (!email.trim()) {
      setStatus("Enter your email address first.");
      return;
    }

    try {
      processingRef.current = true;
      setProcessing(true);
      setStatus("Capturing your face...");

      const descriptors = [];

      for (let i = 0; i < 3; i++) {
        setStatus(`Capturing face sample ${i + 1} of 3...`);

        const descriptor = await detectFace();

        descriptors.push(Array.from(descriptor));

        await wait(700);
      }

      const average = averageDescriptors(descriptors);

      if (!average) {
        throw new Error("Unable to create your face profile.");
      }

      const storageKey = `chainSentryFace:${email
        .trim()
        .toLowerCase()}`;

      localStorage.setItem(
        storageKey,
        JSON.stringify({
          descriptor: average,
          createdAt: new Date().toISOString(),
        })
      );

      setStatus("Face registration successful.");

      await wait(700);

      onSuccess({
        type: "register",
        message: "Face registered successfully.",
      });
    } catch (error) {
      console.error("FACE REGISTRATION ERROR:", error);

      setStatus(error.message || "Face registration failed.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleVerify = async () => {
    if (processingRef.current) return;

    if (!email.trim()) {
      setStatus("Enter your email address first.");
      return;
    }

    try {
      processingRef.current = true;
      setProcessing(true);

      const storageKey = `chainSentryFace:${email
        .trim()
        .toLowerCase()}`;

      const storedData = localStorage.getItem(storageKey);

      if (!storedData) {
        throw new Error(
          "No face is registered for this email. Register your face first."
        );
      }

      const parsedData = JSON.parse(storedData);

      if (!parsedData.descriptor) {
        throw new Error(
          "Stored face profile is invalid. Please register again."
        );
      }

      const storedDescriptor = new Float32Array(
        parsedData.descriptor
      );

      const distances = [];

      for (let i = 0; i < 3; i++) {
        setStatus(`Verifying face sample ${i + 1} of 3...`);

        const currentDescriptor = await detectFace();

        const distance = faceapi.euclideanDistance(
          storedDescriptor,
          currentDescriptor
        );

        distances.push(distance);

        await wait(700);
      }

      const MATCH_THRESHOLD = 0.50;

      const successfulMatches = distances.filter(
        (distance) => distance <= MATCH_THRESHOLD
      ).length;

      const bestDistance = Math.min(...distances);

      console.log("Face distances:", distances);
      console.log("Best face distance:", bestDistance);
      console.log("Successful matches:", successfulMatches);

      if (successfulMatches < 2) {
        throw new Error(
          `Face verification failed. Similarity distance: ${bestDistance.toFixed(
            3
          )}`
        );
      }

      setStatus("Face verified successfully.");

      await wait(500);

      onSuccess({
        type: "login",
        message: "Face verification successful.",
      });
    } catch (error) {
      console.error("FACE VERIFICATION ERROR:", error);

      setStatus(error.message || "Face verification failed.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <div className="face-auth-overlay">
      <div className="face-auth-card">

        <div className="face-auth-header">
          <div>
            <h2>
              {mode === "register"
                ? "Register Your Face"
                : "Face Verification"}
            </h2>

            <p>
              {email}
            </p>
          </div>

          <button
            type="button"
            className="face-auth-close"
            onClick={onClose}
            disabled={processing}
          >
            ×
          </button>
        </div>

        <div className="face-camera-container">

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="face-camera"
          />

          <div className="face-guide">
            <div className="face-guide-corner top-left"></div>
            <div className="face-guide-corner top-right"></div>
            <div className="face-guide-corner bottom-left"></div>
            <div className="face-guide-corner bottom-right"></div>

            <div className="face-guide-text">
              Keep your face inside the frame
            </div>
          </div>

        </div>

        {cameraError ? (
          <div className="login-error face-auth-error">
            <span className="login-error-icon">
              !
            </span>

            <span>
              {cameraError}
            </span>
          </div>
        ) : (
          <div className="face-auth-status">
            {status}
          </div>
        )}

        <div className="face-auth-actions">

          {mode === "register" ? (
            <button
              type="button"
              className="login-primary-button"
              onClick={handleRegister}
              disabled={!cameraReady || processing || !!cameraError}
            >
              {processing ? (
                <>
                  <span className="login-spinner"></span>
                  Registering...
                </>
              ) : (
                <>
                  Register Face
                  <span>→</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="login-primary-button"
              onClick={handleVerify}
              disabled={!cameraReady || processing || !!cameraError}
            >
              {processing ? (
                <>
                  <span className="login-spinner"></span>
                  Verifying...
                </>
              ) : (
                <>
                  Verify Face
                  <span>→</span>
                </>
              )}
            </button>
          )}

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
          <span className="security-dot"></span>

          <span>
            Face matching is processed in your browser for this demo.
          </span>
        </div>

      </div>
    </div>
  );
}

export default FaceRecognition;