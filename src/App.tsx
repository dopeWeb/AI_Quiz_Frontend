// src/App.tsx
import React, { useState, useEffect } from "react";
import { Link, Routes, Route } from "react-router-dom";
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer, toast } from 'react-toastify';
import axios from "axios";
import QuizDisplay from "./QuizDisplay.tsx";
import "./QuizGenerator.css";
import GeneratingModal from "./GeneratingModal.tsx";
import Register from "./Register.tsx";
import Login from "./Login.tsx";
import Account from "./Account.tsx";
import SaveQuiz from "./SaveQuiz.tsx";
import QuizEditor from "./QuizEditor.tsx";
import QuizTake from "./QuizTake.tsx";
import LogoutLink from "./LogoutLink.tsx";

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

function App() {
  const [openaiApiKey] = useState("");
  const [context, setContext] = useState("");
  const [quizData, setQuizData] = useState<any>(null);
  const [error, setError] = useState("");
  const MAX_CHARS = 5000;
  const [showModal, setShowModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionType, setQuestionType] = useState("multiple-choice");
  const [numQuestions, setNumQuestions] = useState("3");
  const [language, setLanguage] = useState("English");
  const [dashboard, setDashboard] = useState(""); // Dashboard name is required

  // Initialize auth state from localStorage to avoid flash on refresh
  const storedAuth = localStorage.getItem("isAuthenticated");
  const initialAuthState = storedAuth ? JSON.parse(storedAuth) : null;
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(initialAuthState);
  const [username, setUsername] = useState("");

  const countWithoutSpaces = (text: string) => text.replaceAll(" ", "").length;

  // Create a function to check authentication from the backend
  const checkAuth = () => {
    axios
      .get("http://localhost:8000/api/check-auth/", { withCredentials: true })
      .then((response) => {
        if (response.data.authenticated) {
          setIsAuthenticated(true);
          setUsername(response.data.username);
        } else {
          setIsAuthenticated(false);
          setUsername("");
        }
      })
      .catch((error) => {
        console.error("Auth check error:", error);
        setIsAuthenticated(false);
        setUsername("");
      });
  };

  // On mount, check if the session is authenticated.
  useEffect(() => {
    checkAuth();
  }, []);
  
  // Check authentication on mount via backend account endpoint.
  useEffect(() => {
    axios
      .get("http://localhost:8000/api/account/", { withCredentials: true })
      .then(() => {
        setIsAuthenticated(true);
        localStorage.setItem("isAuthenticated", "true");
      })
      .catch(() => {
        setIsAuthenticated(false);
        localStorage.setItem("isAuthenticated", "false");
      });
  }, []);

  const handleOpenModal = () => {
    setError("");
    setShowModal(true);
  };

  const handleModalGenerate = async () => {
    if (!dashboard) {
      toast.error("Dashboard name is required.");
      return;
    }
    setShowModal(false);
    setIsGenerating(true);
    const csrfToken = getCookie("csrftoken");

    try {
      // ★ Check: Verify if user already has 5 dashboards.
      const accountResponse = await axios.get("http://localhost:8000/api/account/", { withCredentials: true });
      const accountData = accountResponse.data;
      if (accountData && accountData.quizzes) {
        const uniqueDashboards = new Set(accountData.quizzes.map((quiz: any) => quiz.title));
        if (!uniqueDashboards.has(dashboard) && uniqueDashboards.size >= 5) {
          toast.error("You have reached the maximum number of dashboards (5).");
          setIsGenerating(false);
          return;
        }
      }

      let existingQuiz: any = null;
      if (accountData && accountData.quizzes && accountData.user) {
        const currentUserId = accountData.user.id;
        existingQuiz = accountData.quizzes.find((quiz: any) =>
          quiz.title.trim().toLowerCase() === dashboard.trim().toLowerCase() &&
          quiz.created_by === currentUserId
        );
        if (existingQuiz) {
          const quizDetailResponse = await axios.get(
            `http://localhost:8000/api/quizzes/${existingQuiz.quiz_id}`,
            { withCredentials: true }
          );
          const fullQuiz = quizDetailResponse.data;
          const currentCount = fullQuiz.questions ? fullQuiz.questions.length : 0;
          if (currentCount >= 50) {
            toast.error("This dashboard already has the maximum of 50 questions.");
            setIsGenerating(false);
            return;
          }
        }
      }

      const generateResponse = await axios.post(
        "http://localhost:8000/api/quiz",
        {
          openai_api_key: openaiApiKey,
          context,
          num_questions: Number(numQuestions),
          quiz_type: questionType,
          language: language,
          dashboard: dashboard,
        },
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrfToken || "" },
        }
      );
      const generatedQuizData = generateResponse.data;
      generatedQuizData.language = language;

      if (existingQuiz) {
        const quizDetailResponse = await axios.get(
          `http://localhost:8000/api/quizzes/${existingQuiz.quiz_id}`,
          { withCredentials: true }
        );
        const fullQuiz = quizDetailResponse.data;
        const currentCount = fullQuiz.questions ? fullQuiz.questions.length : 0;
        const newQuestionsCount = generatedQuizData.questions ? generatedQuizData.questions.length : 0;
        if (currentCount + newQuestionsCount > 50) {
          toast.error("Adding these questions would exceed the maximum of 50 questions for this dashboard.");
          setIsGenerating(false);
          return;
        }
      } 

      const saveResponse = await axios.post(
        "http://localhost:8000/api/quiz/save/",
        {
          dashboard: dashboard,
          quiz_data: generatedQuizData,
        },
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrfToken || "" },
        }
      );
      console.log("Quiz saved/updated successfully:", saveResponse.data);
      setQuizData(generatedQuizData);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong.");
    }

    setIsGenerating(false);
  };

  const handleCancelModal = () => {
    setShowModal(false);
  };

  const handleReturn = () => {
    setQuizData(null);
  };

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        aria-label="Toast Container"
      />

      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="home-link">Home</Link>
          {isAuthenticated === null ? (
            <div className="auth-loading">Loading...</div>
          ) : isAuthenticated ? (
            <div className="account-dropdown-container">
              <button className="account-dropdown-btn">
                <span className="user-icon"></span>
                {username}
              </button>
              <div className="account-dropdown-content">
                <Link to="/account" className="account-link">My Account</Link>
                <Link to="/saved-quizzes" className="account-link">Saved Quizzes</Link>
                <LogoutLink
                  setIsAuthenticated={setIsAuthenticated}
                  setUsername={setUsername}
                />
              </div>
            </div>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link">Sign Up</Link>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route
          path="/"
          element={
            <div className="quiz-generator-container">
              <h1 className="quiz-generator-title">AI Quiz</h1>
              {isGenerating && <GeneratingModal show={isGenerating} />}
              <div className="quiz-content-container">
                {!quizData && !isGenerating && (
                  <>
                    <label className="quiz-generator-label">Context:</label>
                    <div className="input-field-container">
                      <textarea
                        className="quiz-generator-textarea"
                        placeholder="you can leave this field empty; AI will come up with something"
                        value={context}
                        onChange={(e) => {
                          const lengthNoSpaces = countWithoutSpaces(e.target.value);
                          if (lengthNoSpaces <= MAX_CHARS) {
                            setContext(e.target.value);
                          }
                        }}
                      />
                      <div className="quiz-generator-charcount">
                        {countWithoutSpaces(context)}/{MAX_CHARS} characters
                      </div>
                      {!isAuthenticated && (
                        <div className="field-overlay">
                          <p>You need to log in to use this field.</p>
                          <div>
                            <Link to="/login" className="overlay-btn">Login</Link>
                            <Link to="/register" className="overlay-btn">Register</Link>
                          </div>
                        </div>
                      )}
                    </div>
                    {error && <p className="quiz-generator-error">{error}</p>}
                    <button
                      onClick={handleOpenModal}
                      className="quiz-generator-generate-btn"
                      disabled={!isAuthenticated}
                    >
                      Next
                    </button>
                  </>
                )}
                {quizData && !isGenerating && (
                  <div className="quiz-generator-quizdata">
                    <QuizDisplay quizData={quizData} quizType={questionType} />
                    <button onClick={handleReturn} className="quiz-generator-return-btn">
                      Return
                    </button>
                  </div>
                )}
              </div>
              {showModal && (
                <div className="quiz-generator-modal-backdrop">
                  <div className="quiz-generator-modal-container">
                    <h3 className="quiz-generator-modal-heading">Options</h3>
                    <label className="quiz-generator-label" htmlFor="quiz-dashboard">
                      Dashboard:
                    </label>
                    <div className="quiz-generator-input-container">
                      <input
                        id="quiz-dashboard"
                        type="text"
                        value={dashboard}
                        onChange={(e) => setDashboard(e.target.value)}
                        placeholder="Enter dashboard name"
                        required
                        className="quiz-generator-input"
                        maxLength={20}
                      />
                      <div className="dashboard-charcount">
                        {dashboard.length}/20 characters
                      </div>
                    </div>
                    <label className="quiz-generator-label" htmlFor="quiz-generator-question-type">
                      Question Type
                    </label>
                    <select
                      id="quiz-generator-question-type"
                      value={questionType}
                      onChange={(e) => setQuestionType(e.target.value)}
                      className="quiz-generator-dropdown"
                    >
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="true-false">True/False</option>
                      <option value="open-ended">Open Ended</option>
                    </select>
                    <label className="quiz-generator-label" htmlFor="quiz-generator-num-questions">
                      Number of Questions
                    </label>
                    <input
                      id="quiz-generator-num-questions"
                      type="range"
                      min="1"
                      max="10"
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(e.target.value)}
                      className="quiz-generator-slider"
                    />
                    <div className="quiz-generator-slider-value">
                      {numQuestions} Questions
                    </div>
                    <label className="quiz-generator-label" htmlFor="quiz-generator-language">
                      Language
                    </label>
                    <select
                      id="quiz-generator-language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="quiz-generator-dropdown"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Russian">Russian</option>
                      <option value="German">German</option>
                      <option value="French">French</option>
                      <option value="Chinese">Chinese</option>
                    </select>
                    <div className="quiz-generator-modal-actions">
                      <button onClick={handleCancelModal} className="quiz-generator-cancel-btn">
                        Cancel
                      </button>
                      <button onClick={handleModalGenerate} className="quiz-generator-confirm-btn">
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          }
        />
        {/* Auth routes */}
        <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/register" element={<Register setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/account" element={<Account />} />
        <Route path="/saved-quizzes" element={<SaveQuiz />} />
        <Route path="/quiz-editor/:quizId" element={<QuizEditor />} />
        <Route path="/quiz/take/:quizId" element={<QuizTake />} />
      </Routes>
    </>
  );
}

export default App;
