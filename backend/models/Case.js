import { useState, useEffect } from "react";

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [riskScore, setRiskScore] = useState("Medium");
  const [loading, setLoading] = useState(false);

  const API_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

  const fetchCases = async () => {
    try {
      const response = await fetch(`${API_URL}/cases`);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      // Make sure we always store an array
      setCases(Array.isArray(data) ? data : data.cases || []);
    } catch (error) {
      console.error("Error fetching cases:", error);
      setCases([]);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          riskScore,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      setTitle("");
      setDescription("");
      setRiskScore("Medium");

      await fetchCases();
    } catch (error) {
      console.error("Error creating case:", error);
      alert("Failed to create case. Check your backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>ChainSentry Fraud Investigation</h1>

      {/* Create Case */}
      <div
        style={{
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "10px",
          marginBottom: "30px",
        }}
      >
        <h2>Report New Fraud Case</h2>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <input
            type="text"
            placeholder="Case Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            placeholder="Case Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />

          <select
            value={riskScore}
            onChange={(e) => setRiskScore(e.target.value)}
          >
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
            <option value="Critical">Critical Risk</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Submit Case"}
          </button>
        </form>
      </div>

      {/* Cases */}
      <h2>Active Investigation Cases ({cases.length})</h2>

      {cases.length === 0 ? (
        <p>No active cases recorded.</p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >
          {cases.map((c) => (
            <div
              key={c.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <h3>{c.title}</h3>

              <p>{c.description}</p>

              <strong>
                Risk: {c.riskScore || c.riskLevel || "Unknown"}
              </strong>

              <br />

              <small>ID: {c.id}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}