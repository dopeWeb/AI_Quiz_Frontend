// ForgotPassword.tsx
import React, { useState } from 'react';
import axios from 'axios';
import "./Auth.css";


const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // This is a simple check that assumes Google-authenticated users use Gmail.
    // You may adjust this logic to suit your app’s requirements.
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setError(null);
      
        try {
          const response = await axios.post("http://localhost:8000/api/forgot-password/", { email });
          setMessage(response.data.message);
        } catch (err: any) {
          const errorMessage = err.response?.data?.error || 'An error occurred.';
          // Check if the error indicates a Google account issue
          if (errorMessage.toLowerCase().includes("google authentication")) {
            setError("Your account is registered using Google authentication. Please log in using Google instead.");
          } else if (
            err.response?.status === 404 ||
            errorMessage.toLowerCase().includes("not found")
          ) {
            setError("Email not found.");
          } else {
            setError(errorMessage);
          }
        } finally {
          setLoading(false);
        }

    };

    return (
        <div className="forgot-password-form" style={{ margin: "2rem" }}>
            <h2>Forgot your password?</h2>
            <p className="description">
                Enter your email address and we’ll send you a link to reset it.
            </p>
            <form onSubmit={handleSubmit}>
                <label htmlFor="email">Email:</label>
                <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="reset-button"
                >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>
            {message && <p className="message">{message}</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            <div className="extra-links">
                <a href="/login">Back to Login</a>
            </div>
        </div>
    );
};

export default ForgotPassword;

