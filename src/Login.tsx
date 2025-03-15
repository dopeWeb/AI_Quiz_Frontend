import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import googleLogo from './img/png-transparent-g-suite-google-play-google-logo-google-text-logo-cloud-computing-thumbnail-removebg-preview.png';
import "./Auth.css";

// Helper function to get a cookie by name
function getCookie(name: string): string | null {
  let cookieValue: string | null = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

interface LoginProps {
  setIsAuthenticated: (auth: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ setIsAuthenticated }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleGoogleLogin = async (googleToken: string) => {
    try {
      const csrfToken = getCookie("csrftoken");
      const response = await axios.post(
        "http://localhost:8000/api/google-signup-or-login/", // or google-signup/ if the same endpoint
        { token: googleToken },
        {
          withCredentials: true,
          headers: {
            "X-CSRFToken": csrfToken || "",
          },
        }
      );
      console.log("Google Login successful:", response.data);
      setSuccess("Logged in with Google successfully!");
      setError("");
      setIsAuthenticated(true);
      navigate("/");
      window.location.reload(); // Automatically refresh the page
    } catch (err: any) {
      console.error("Google Login error:", err);
      setError("Google Login failed.");
      setSuccess("");
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const csrfToken = getCookie("csrftoken");
      const response = await axios.post(
        "http://localhost:8000/api/login/",
        { username, password },
        {
          withCredentials: true,
          headers: {
            "X-CSRFToken": csrfToken || "",
          },
        }
      );
      console.log("Login successful:", response.data);
      setSuccess("Login successful! You are now logged in.");
      setError("");
      setIsAuthenticated(true);
      navigate("/");
      window.location.reload(); // Automatically refresh the page
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Invalid credentials. Please try again.");
      setSuccess("");
    }
  };

  const login = useGoogleLogin({
    onSuccess: (credentialResponse) => {
      if (credentialResponse.access_token) {
        handleGoogleLogin(credentialResponse.access_token);
      }
    },
    onError: () => {
      console.log('Google Login failed');
      setError('Google Login failed. Please try again.');
    },
  });

  return (
    <div className="auth-container">
      <button className="auth-close-button" onClick={() => navigate("/")}>
        &times;
      </button>

      <h2 className="auth-title">Login</h2>

      <button className="google-button" onClick={() => login()}>
        <img src={googleLogo} alt="Google logo" className="google-icon" />
        <span>Login with Google</span>
      </button>

      <div className="auth-divider">
        <span>Or</span>
      </div>

      <form onSubmit={handleLogin} className="auth-form">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}

        <button type="submit">Login</button>
      </form>

      <div className="auth-footer">
        <a href="/forgot-password">Forgot your password?</a>
        <br />
        <a href="/register">Create Account</a>
      </div>
    </div>
  );
};

export default Login;
