import { useEffect, useState } from "react";
import { onAuthStateChanged, getIdTokenResult } from "firebase/auth";
import { auth } from "../firebase";

const INVESTIGATOR_EMAIL = "investigator@gmail.com";

export default function usePermissions() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (mounted) {
          setRole(null);
          setUserEmail("");
          setLoading(false);
        }
        return;
      }

      try {
        const email = String(user.email || "")
          .trim()
          .toLowerCase();

        console.log("TraceX authenticated user:", email);

        // Refresh Firebase token.
        await getIdTokenResult(user, true);

        if (!mounted) return;

        setUserEmail(email);

        // investigator@gmail.com = editor
        if (email === INVESTIGATOR_EMAIL) {
          console.log("TraceX permission: EDITOR");
          setRole("editor");
        } else {
          console.log("TraceX permission: VIEWER");
          setRole("viewer");
        }
      } catch (error) {
        console.error(
          "Unable to load user permissions:",
          error
        );

        if (mounted) {
          setRole("viewer");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    role,
    userEmail,
    loading,

    // This is what VASPs.jsx should use.
    isEditor:
      role === "editor" &&
      userEmail === INVESTIGATOR_EMAIL,
  };
}