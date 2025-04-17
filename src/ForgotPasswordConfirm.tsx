import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./css/Auth.css";
import zxcvbn from "zxcvbn";


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
  
    // Check if newPassword matches confirmPassword.
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
  
    // Validate password strength.
    const pwdResult = zxcvbn(newPassword);
    const strengthScore = newPassword ? pwdResult.score : 0;
  
    // If the password is "Very Weak" (score 0) or "Weak" (score 1), show an error.
    if (strengthScore < 2) {
      setError(
        "Password is too weak. It should be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character."
      );
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
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError("Error resetting password. Please try again.");
      }
    }
  };


    const pwdResult = zxcvbn(newPassword);
    const strengthScore = newPassword ? pwdResult.score : 0;
    let strengthLabel = "";
    let strengthColor = "#ccc";
  
    switch (strengthScore) {
      case 0:
        strengthLabel = "Very Weak";
        strengthColor = "#ff0000";
        break;
      case 1:
        strengthLabel = "Weak";
        strengthColor = "#ff4000";
        break;
      case 2:
        strengthLabel = "Fair";
        strengthColor = "#ff8000";
        break;
      case 3:
        strengthLabel = "Strong";
        strengthColor = "#00c853";
        break;
      case 4:
        strengthLabel = "Very Strong";
        strengthColor = "#008000";
        break;
      default:
        break;
    }

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

          {newPassword && (
          <div style={{ marginTop: "8px", minHeight: "60px", width: "100%" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: "10px",
                    backgroundColor: i < strengthScore ? strengthColor : "#e0e0e0",
                    borderRadius: "5px",
                  }}
                />
              ))}
            </div>
            <div style={{ marginTop: "8px" }}>
              <small>Password Strength: {strengthLabel}</small>
            </div>
          </div>
        )}
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
