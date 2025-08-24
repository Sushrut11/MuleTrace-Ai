import React, { useState } from "react";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === "admin" && password === "123456789") {
      setError("");
      onLogin();
    } else {
      setError("Incorrect username or password.");
    }
  };

  return (
    <div className="login-container enhanced-login">
      <h2 className="login-title">🔒 Admin Login</h2>
      <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
        <div className="login-input-group">
          <label htmlFor="login-username">Username</label>
          <div className="login-input-wrapper">
            <span className="login-input-icon">
              <svg width="18" height="18" fill="#cd9bff" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 100-8 4 4 0 000 8z"/>
              </svg>
            </span>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
              placeholder="Enter username"
            />
          </div>
        </div>
        <div className="login-input-group">
          <label htmlFor="login-password">Password</label>
          <div className="login-input-wrapper">
            <span className="login-input-icon">
              <svg width="18" height="18" fill="#cd9bff" viewBox="0 0 24 24">
                <path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-7V7a6 6 0 10-12 0v3a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2zm-8-3a4 4 0 118 0v3H6V7z"/>
              </svg>
            </span>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
            />
          </div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <button className="login-btn enhanced-login-btn" type="submit">
          Login
        </button>
      </form>
    </div>
  );
};

export default Login;
