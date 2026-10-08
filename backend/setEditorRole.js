require("dotenv").config();

const {
  adminAuth,
} = require("./firebase");

async function setEditorRole() {
  try {
    if (!adminAuth) {
      throw new Error(
        "Firebase Admin Authentication is not configured."
      );
    }

    const email = "investigator@gmail.com";

    const user =
      await adminAuth.getUserByEmail(email);

    console.log(
      `Found Firebase user: ${user.email}`
    );

    await adminAuth.setCustomUserClaims(
      user.uid,
      {
        role: "editor",
      }
    );

    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      "EDITOR ROLE ASSIGNED SUCCESSFULLY"
    );
    console.log(
      "========================================"
    );
    console.log(`Email: ${email}`);
    console.log(`UID: ${user.uid}`);
    console.log("Role: editor");
    console.log(
      "========================================"
    );
    console.log("");
    console.log(
      "The user must sign in again or refresh their ID token."
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Unable to assign editor role:",
      error
    );

    process.exit(1);
  }
}

setEditorRole();