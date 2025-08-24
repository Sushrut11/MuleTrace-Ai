import React, { useState } from "react";
import TxnForm from "./components/TxnForm";
import CsvUpload from "./components/CsvUpload";
import Login from "./components/Login";
import "./App.css";

function App() {
  // State to manage authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Logout handler
  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // If not authenticated, show only the login page (centered)
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
        <Login onLogin={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  // If authenticated, show your current UI with logout button at top-right
  return (
    <div>
      {/* Logout button at top right */}
      <div style={{
        position: "absolute",
        top: 25,
        right: 40,
        zIndex: 10
      }}>
        <button
          onClick={handleLogout}
          style={{
            background: "#6a1b9a",
            color: "#fff",
            border: "none",
            padding: "0.5rem 1.1rem",
            borderRadius: "4px",
            fontWeight: "bold",
            fontSize: "1rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
          }}
        >
          Logout
        </button>
      </div>
      {/* Your original UI */}
      <div className="form-container">
        <h1>Mule Trace</h1>
        <h2>An AI-Driven Model for Detecting Fraudulent Bank Accounts<br />and Payment Wallets</h2>
        <TxnForm />
        <CsvUpload />
      </div>
    </div>
  );
}

export default App;
