// src/SaveQuiz.tsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import "./SaveQuiz.css";

// Example helper to get cookie by name
function getCookie(name: string): string {
  let cookieValue = "";
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

interface Question {
  question_id: number;
  text: string;
  question_type: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;
  is_deleted?: boolean;
}

interface Quiz {
  quiz_id: number;
  title: string;
  language: string;
  created_at: string;
  questions: Question[];
}

interface AccountData {
  user: {
    username: string;
    email: string;
  };
  // We assume account endpoint now returns only quiz IDs and basic info.
  quizzes: { quiz_id: number }[];
}

// Type for updated counts dictionary: { [quizId]: number }
type UpdatedCounts = Record<number, number>;

const SaveQuiz: React.FC = () => {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]); // full quiz details
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Get updated quiz data and counts passed from QuizEditor (if any)
  const passedQuiz = location.state?.quizData as Quiz | undefined;
  const updatedCounts = (location.state?.updatedCounts as UpdatedCounts) || {};

  // First, fetch account data to get the list of quiz IDs.
  useEffect(() => {
    axios
      .get("http://localhost:8000/api/account/", { withCredentials: true })
      .then((response) => {
        const data = response.data as AccountData;
        setAccountData(data);
      })
      .catch((err) => {
        console.error("Error fetching account data:", err);
        setError("Error fetching account data.");
      });
  }, []);

  // Then, for each quiz id in accountData, fetch full quiz details from /api/quizzes/${quizId}
  useEffect(() => {
    if (!accountData) {
      setLoading(false);
      return;
    }
    const fetchQuizzes = async () => {
      try {
        const quizRequests = accountData.quizzes.map((qInfo) =>
          axios.get(`http://localhost:8000/api/quizzes/${qInfo.quiz_id}`, {
            withCredentials: true,
          })
        );
        const quizResponses = await Promise.all(quizRequests);
        let fetchedQuizzes = quizResponses.map((res) => res.data as Quiz);

        // For each quiz, filter out soft-deleted questions.
        fetchedQuizzes = fetchedQuizzes.map((quiz) => ({
          ...quiz,
          questions: quiz.questions ? quiz.questions.filter((q: Question) => !q.is_deleted) : [],
        }));

        // If an updated quiz was passed from QuizEditor, override the corresponding quiz.
        if (passedQuiz) {
          fetchedQuizzes = fetchedQuizzes.map((quiz) =>
            quiz.quiz_id === passedQuiz.quiz_id
              ? {
                ...passedQuiz,
                questions: passedQuiz.questions.filter((q: Question) => !q.is_deleted),
              }
              : quiz
          );
        }

        setQuizzes(fetchedQuizzes);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching full quiz details:", err);
        setError("Error fetching quiz details.");
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [accountData, passedQuiz]);

  // These functions remain the same (for deletion/editing quizzes)
  const handleDeleteQuiz = async (quizId: number) => {
    try {
      const csrftoken = getCookie("csrftoken");
      await axios.patch(
        `http://localhost:8000/api/quizzes/${quizId}/softdelete`,
        {},
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrftoken },
        }
      );
      // Remove the deleted quiz from local state.
      setQuizzes((prev) => prev.filter((quiz) => quiz.quiz_id !== quizId));
    } catch (err) {
      console.error("Error soft-deleting quiz:", err);
      setError("Error deleting quiz. Please try again.");
    }
  };

  const handleEditQuiz = (quizId: number) => {
    navigate(`/quiz-editor/${quizId}`);
  };

  if (loading) {
    return <p>Loading saved quizzes...</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  if (!accountData) {
    return <p>No account data available.</p>;
  }

  return (
    <div className="save-quiz-wrapper">
      <h2 className="save-quiz-title">{accountData.user.username}'s Dashboard</h2>
      <div className="save-quiz-subtitle">Quizzes</div>

      <div className="quiz-list-container">
        {quizzes && quizzes.length > 0 ? (
          quizzes.map((quiz) => {
            // Use updated count from passed updatedCounts if available.
            const numQuestions =
              updatedCounts[quiz.quiz_id] !== undefined
                ? updatedCounts[quiz.quiz_id]
                : quiz.questions?.length || 0;
            const daysAgo = Math.floor(
              (new Date().getTime() - new Date(quiz.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
            );

            return (
              <div key={quiz.quiz_id} className="quiz-card">
                <div className="quiz-card-header">
                  <h3 className="quiz-card-title">{quiz.title}</h3>
                  <div className="quiz-card-menu">⋮</div>
                </div>

                <div className="quiz-card-meta">
                  <span>
                    {numQuestions}{" "}
                    {numQuestions === 1 ? "question" : "questions"} • {daysAgo}{" "}
                    {daysAgo === 1 ? "day" : "days"} ago
                  </span>
                </div>

                <div className="quiz-card-actions">
                  <button
                    className="quiz-card-edit-btn"
                    onClick={() => handleEditQuiz(quiz.quiz_id)}
                  >
                    Edit
                  </button>
                  <button
                    className="quiz-card-start-btn"
                    onClick={() =>
                      navigate(`/quiz/take/${quiz.quiz_id}`, { state: { quizData: quiz } })
                    }
                  >
                    Start
                  </button>
                  <button
                    className="quiz-card-delete-btn"
                    onClick={() => handleDeleteQuiz(quiz.quiz_id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p>No saved quizzes found.</p>
        )}
      </div>
    </div>
  );
};

export default SaveQuiz;
