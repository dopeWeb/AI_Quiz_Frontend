import React, { useState } from "react";
import axios from "axios";
import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import googleLogo from './img/png-transparent-g-suite-google-play-google-logo-google-text-logo-cloud-computing-thumbnail-removebg-preview.png';
import "./Auth.css";

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
interface RegisterProps {
  setIsAuthenticated?: (auth: boolean) => void;
}

const Register: React.FC<RegisterProps> = ({ setIsAuthenticated }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleGoogleSignup = async (googleToken: string) => {
    try {
      const csrfToken = getCookie("csrftoken");
      const response = await axios.post(
        "http://localhost:8000/api/google-signup-or-login/",
        { token: googleToken },
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrfToken || "" },
        }
      );
      console.log("Google Sign-Up successful:", response.data);
      setSuccess("Signed up with Google successfully! You are now logged in.");
      setError("");
      setIsAuthenticated(true);
      navigate("/");
      // Force a full reload so that the account dropdown appears immediately
      window.location.reload();
    } catch (err: any) {
      console.error("Google Sign-Up error:", err);
      setError("Google Sign-Up failed. Please try again.");
      setSuccess("");
    }
  };
  

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const csrfToken = getCookie("csrftoken");
      const response = await axios.post(
        "http://localhost:8000/api/register/",
        { username, email, password },
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrfToken || "" },
        }
      );
      console.log("Registration successful:", response.data);
      setSuccess("Registration successful! You can now log in.");
      setError("");
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(
        err.response?.data?.error ||
          "Registration failed. Please try a different username or email."
      );
      setSuccess("");
    }
  };


  const signup = useGoogleLogin({
    onSuccess: (credentialResponse) => {
      if (credentialResponse.access_token) {
        handleGoogleSignup(credentialResponse.access_token);
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

      <h2 className="auth-title">Sign Up</h2>

      <button className="google-button" onClick={() => signup()}>
      <img src={googleLogo} alt="Google logo" className="google-icon" />
      <span>Sign Up with Google</span>
      </button>


      <div className="auth-divider">
        <span>Or</span>
      </div>

      <form onSubmit={handleRegister} className="auth-form">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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

        <button type="submit">Sign Up</button>
      </form>

      <div className="auth-footer">
        <a href="/login">Login to an existing account</a>
      </div>
    </div>
  );
};

export default Register;
