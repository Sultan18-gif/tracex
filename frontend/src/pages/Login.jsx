import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    // Demo login
    localStorage.setItem("authenticated", "true");

    navigate("/dashboard");
  };

  return (
    <div className="cs-login-screen">
      <div className="cs-login-card">

        {/* Logo / Brand */}
        <div className="cs-login-brand">
          <div className="cs-login-icon">CS</div>

          <h1>Chain Sentry</h1>

          <p>
            Blockchain Intelligence &amp; Investigation Platform
          </p>
        </div>

        {/* Login heading */}
        <div>
          <h2>Welcome back</h2>
          <p>Sign in to access the investigation dashboard.</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="cs-login-form">

          <div className="cs-field">
            <label htmlFor="email">
              Agency ID / Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investigator@agency.gov"
              autoComplete="email"
            />
          </div>

          <div className="cs-field">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="cs-login-error">
              {error}
            </div>
          )}

          <label className="cs-login-check">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>

          <button
            type="submit"
            className="cs-login-submit"
          >
            Sign In
          </button>

        </form>

        {/* Security information */}
        <div className="cs-login-footer">
          Secure encrypted connection
          <br />
          Authorized investigators only
        </div>

      </div>
    </div>
  );
}