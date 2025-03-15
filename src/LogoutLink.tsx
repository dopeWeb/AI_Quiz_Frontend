// src/LogoutLink.tsx
import React from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { googleLogout } from "@react-oauth/google";
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

interface LogoutLinkProps {
  setIsAuthenticated: (value: boolean) => void;
  setUsername?: (value: string) => void;
}

const LogoutLink: React.FC<LogoutLinkProps> = ({ setIsAuthenticated, setUsername }) => {
  const navigate = useNavigate();

  const handleLogout = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // Prevent default navigation
    try {
      // Clear Google token state
      googleLogout();

      const csrfToken = getCookie("csrftoken");
      await axios.post(
        "http://localhost:8000/api/logout/",
        {},
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrfToken || "" },
        }
      );
      console.log("Logout successful");
      setIsAuthenticated(false);
      if (setUsername) {
        setUsername("");
      }
      navigate("/login");
    } catch (error: any) {
      console.error("Logout error:", error);
      alert("Logout failed. Please try again.");
    }
  };

  return (
    <a href="#" className="account-link" onClick={handleLogout}>
      Logout
    </a>
  );
};

export default LogoutLink;
