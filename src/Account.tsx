// src/Account.tsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Account.css"; // Ensure your dropdown/account styles are defined here

interface Quiz {
  quiz_id: number;
  title: string;
  language: string;
  created_at: string;
}

interface AccountData {
  user: {
    username: string;
    email: string;
  };
  quizzes: Quiz[];
}

const Account: React.FC = () => {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Helper function to get a cookie by name
  const getCookie = (name: string): string | null => {
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
  };

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        const csrfToken = getCookie("csrftoken");
        const response = await axios.get("http://localhost:8000/api/account/", {
          withCredentials: true,
          headers: {
            "X-CSRFToken": csrfToken || ""
          },
        });
        setAccountData(response.data);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching account data:", err);
        setError("Error fetching account data.");
        setLoading(false);
      }
    };

    fetchAccountData();
  }, []);

  if (loading) {
    return <p>Loading account information...</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  if (!accountData) {
    return <p>No account data available.</p>;
  }

  return (
    <div className="account-container">
      <h2>Account Information</h2>
      <p>
        <strong>Username:</strong> {accountData.user.username}
      </p>
      <p>
        <strong>Email:</strong> {accountData.user.email}
      </p>
      <button onClick={() => navigate("/")}>Back to Home</button>
    </div>
  );
};

export default Account;
