import React, { useState } from 'react';
import axios from 'axios';
import QuizDisplay from './QuizDisplay.tsx';
import "./QuizGenerator.css";


function App() {
  const [openaiApiKey] = useState("");
  const [context, setContext] = useState("");

  // If you still want userAnswers, scoring, etc., keep them in QuizDisplay
  const [quizData, setQuizData] = useState<any>(null);
  const [error, setError] = useState("");

  // Maximum characters for context (ignoring spaces)
  const MAX_CHARS = 5000;

  // For the modal
  const [showModal, setShowModal] = useState(false);

  // Fields in the modal
  const [questionType, setQuestionType] = useState("multiple-choice");
  const [numQuestions, setNumQuestions] = useState("3"); // default "3"

  // NEW: Language state
  const [language, setLanguage] = useState("English");

  // Helper function to count characters ignoring spaces
  const countWithoutSpaces = (text: string) => {
    // If you also want to ignore tabs/newlines, use `text.replace(/\s/g, "")`
    return text.replaceAll(" ", "").length;
  };

  // 1. Main “Generate” button → open the modal (no empty check)
  const handleOpenModal = () => {
    // user can have empty context, no check
    setError("");
    setShowModal(true);
  };

  // 2. Inside the modal → actually generate the quiz
  const handleModalGenerate = async () => {
    try {
      const response = await axios.post("http://localhost:8000/api/quiz", {
        openai_api_key: openaiApiKey,
        context, // can be empty now
        num_questions: Number(numQuestions),
        quiz_type: questionType,
        // NEW: pass chosen language to the backend
        language: language,
      });
      setQuizData(response.data);
      setError("");
      setShowModal(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong.");
      setShowModal(false);
    }
  };

  // Cancel modal
  const handleCancelModal = () => {
    setShowModal(false);
  };

  // Return button to reset quiz
  const handleReturn = () => {
    setQuizData(null);
  };

  return (
    <div className="quiz-generator-container">
      <h1 className="quiz-generator-title">AI Quiz</h1>

      {/* If no quiz yet, show the context form */}
      {!quizData && (
        <>
          <label className="quiz-generator-label">Context:</label>
          <textarea
            className="quiz-generator-textarea"
            placeholder="you can leave this field empty AI will come up with something"
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

          {error && <p className="quiz-generator-error">{error}</p>}

          <button onClick={handleOpenModal} className="quiz-generator-generate-btn">
            Generate
          </button>
        </>
      )}

      {/* If quizData is set, show the quiz and a Return button */}
      {quizData && (
        <div className="quiz-generator-quizdata">
          <QuizDisplay quizData={quizData} quizType={questionType} />
          <button onClick={handleReturn} className="quiz-generator-return-btn">
            Return
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="quiz-generator-modal-backdrop">
          <div className="quiz-generator-modal-container">
            <h3 className="quiz-generator-modal-heading">Options</h3>

            {/* Question Type */}
            <label className="quiz-generator-label">Question Type</label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="quiz-generator-dropdown"
            >
              <option value="multiple-choice">Multiple Choice</option>
              <option value="true-false">True/False</option>
              <option value="open-ended">Open Ended</option>
            </select>

            {/* Number of Questions */}
            <label className="quiz-generator-label">Number of Questions</label>
            <input
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

            {/* NEW: Language */}
            <label className="quiz-generator-label">Language</label>
            <select
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

            {/* Actions */}
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
  );
}

export default App;
