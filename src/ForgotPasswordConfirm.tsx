import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./Auth.css";


const ForgotPasswordConfirm: React.FC = () => {
  const { uidb64, token } = useParams<{ uidb64: string; token: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
  }, [uidb64, token, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:8000/api/auth/password-reset-confirm/`,
        { uidb64, token, new_password: newPassword },
        { withCredentials: true }
      );
      console.log("Password reset successfully:", response.data);
      setSuccess("Password reset successfully. Redirecting to login...");
      // Redirect after a short delay.
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      // Check for token-related errors and show an appropriate message.
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError("Error resetting password. Please try again.");
      }
    }
  };

  return (
    <div className="reset-password-container" style={{ margin: "2rem" }}>
      <h2>Reset Your Password</h2>
      {success ? (
        <p style={{ color: "green" }}>{success}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div>
            <input
              type="password"
              name="newPassword"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {/* Hidden inputs to pass uidb64 and token */}
          <input type="hidden" name="uidb64" value={uidb64 || ""} />
          <input type="hidden" name="token" value={token || ""} />
          <button type="submit">Reset Password</button>
        </form>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default ForgotPasswordConfirm;
