// src/QuizTake.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import QuizDisplay from "./QuizDisplay.tsx";
import "./QuizGenerator.css"
import "./QuizTake.css";
;

const QuizTake: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quizId) return;

    console.log("[QuizTake] Fetching quiz data for quizId:", quizId);

    axios
      .get(`http://localhost:8000/api/quizzes/${quizId}`, { withCredentials: true })
      .then((res) => {
        console.log("[QuizTake] Received quiz data from server:", res.data);
        setQuizData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[QuizTake] Error loading quiz data:", err);
        setError("Error loading quiz data.");
        setLoading(false);
      });
  }, [quizId]);

  if (loading) {
    console.log("[QuizTake] Currently loading quiz...");
    return <div>Loading quiz...</div>;
  }
  if (error) {
    console.warn("[QuizTake] Error encountered:", error);
    return <div style={{ color: "red" }}>{error}</div>;
  }
  if (!quizData) {
    console.warn("[QuizTake] No quiz data available.");
    return <div>No quiz data available.</div>;
  }

  // Debug: Log raw quizData keys and content
  console.log("[QuizTake] Raw quizData keys:", Object.keys(quizData));
  console.log("[QuizTake] Raw quizData content:", quizData);

  const handleBack = () => {
    navigate("/saved-quizzes");
  };

  // Transform data if needed.
  const transformedQuizData = {
    ...quizData,
    title: quizData.quiz_text || "Quiz"
  };

  // Determine quizType from the backend (default to "open-ended" if not provided)
  const quizType = quizData.quiz_type || "open-ended";
  console.log("[QuizTake] Determined quizType:", quizType);

  // Debug: If quizData has details, log them before filtering
  if (transformedQuizData.details) {
    console.log("[QuizTake] quizData.details before filtering:", transformedQuizData.details);
  }

  // Remove the three scoring fields if the quiz is not open-ended.
  if (quizType !== "open-ended" && transformedQuizData.details && Array.isArray(transformedQuizData.details)) {
    transformedQuizData.details = transformedQuizData.details.map((detail: any) => {
      const {
        text_similarity_percentage,
        semantic_similarity_percentage,
        overall_score,
        ...rest
      } = detail;
      return rest;
    });
    console.log("[QuizTake] quizData.details after filtering (non-open-ended):", transformedQuizData.details);
  }

  // Debug: Final check on transformedQuizData
  console.log("[QuizTake] Transformed Quiz Data:", transformedQuizData);

  return (
    <div>
      <div>
        <button onClick={handleBack} className="quiz-take-btn left-btn">
          Return to Dashboard
        </button>
        <QuizDisplay quizData={transformedQuizData} quizType={quizType} />
      </div>
    </div>
  );
};

export default QuizTake;
