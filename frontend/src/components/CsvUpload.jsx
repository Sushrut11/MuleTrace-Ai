import React, { useState } from "react";
import api from "../api/apiConfig";
import "../App.css";

const CsvUpload = () => {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const truncateHash = (hash) => {
    if (!hash) return "";
    return hash.slice(0, 5) + "...";
  };

  const handleCopy = (hash, idx) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1200);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("No file provided. Please upload a CSV file.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/upload_csv", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setResults(response.data.results || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "CSV processing failed. Check file format."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h3>Upload Transactions CSV</h3>
      <form onSubmit={handleSubmit}>
        <div className="file-input-wrapper">
          <label htmlFor="file-upload">
            Drag & drop or click to select CSV
          </label>
          <input
            id="file-upload"
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Analyzing..." : "Analyze CSV"}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {results.length > 0 && (
        <table className="results-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Hashed Value</th>
              <th>Sender ID</th>
              <th>Receiver ID</th>
              <th>Fraud Status</th>
              <th>Reason</th>
              <th>Blockchain Link</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index}>
                <td>{result.transaction_id}</td>
                <td
                  style={{
                    cursor: result.hashed_value ? "pointer" : "default",
                    color: "#a259ff",
                    fontWeight: "bold",
                    position: "relative",
                  }}
                  title="Click to copy full hash"
                  onClick={() =>
                    result.hashed_value &&
                    handleCopy(result.hashed_value, index)
                  }
                >
                  {truncateHash(result.hashed_value)}
                  {copiedIdx === index && (
                    <span
                      style={{
                        color: "green",
                        fontSize: 12,
                        marginLeft: 8,
                        position: "absolute",
                      }}
                    >
                      Copied!
                    </span>
                  )}
                </td>

                <td>{result.sender_id}</td>
                <td>{result.receiver_id}</td>
                <td
                  className={
                    result.fraud_status === "Fraudulent"
                      ? "fraudulent"
                      : "legitimate"
                  }
                >
                  {result.fraud_status}
                </td>
                <td>{result.reason}</td>
                <td>
                  {result.blockchain_link ? (
                    <a
                      href={result.blockchain_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on Blockchain
                    </a>
                  ) : (
                    <span style={{ color: "#aaa" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CsvUpload;
