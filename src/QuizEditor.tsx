// src/QuizEditor.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import QuestionEdit from "./QuestionEdit.tsx";
import "./EditQuiz.css";

interface Question {
  question_id: number;
  question_type: string; // e.g. "OE", "MC", "TF"
  text: string;
  // ... other fields as needed
}

interface Quiz {
  quiz_id: number;
  title: string;
  language: string;
  created_at: string;
  questions: Question[];
}

const QuizEditor: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!quizId) return;
    axios
      .get(`http://localhost:8000/api/quizzes/${quizId}`, { withCredentials: true })
      .then((res) => {
        setQuiz(res.data);
        setLoading(false);
      })
      .catch((_err) => {
        setError("Error loading quiz data");
        setLoading(false);
      });
  }, [quizId]);

  const handleSaveQuestion = (updatedQ: Question) => {
    if (!quiz) return;
    const updatedQuestions = quiz.questions.map((q) =>
      q.question_id === updatedQ.question_id ? updatedQ : q
    );
    setQuiz({ ...quiz, questions: updatedQuestions });
  };

  // Delete a question from local state so the count updates immediately
  const handleDeleteQuestion = (deletedId: number) => {
    if (!quiz) {
      console.log("No quiz state found. Cannot delete question.");
      return;
    }
    console.log("handleDeleteQuestion called with questionId:", deletedId);
    console.log("Before deletion, total questions:", quiz.questions.length);
    console.log("Current questions array:", quiz.questions);

    // Filter out the deleted question
    const updatedQuestions = quiz.questions.filter(
      (q) => q.question_id !== deletedId
    );

    console.log("After deletion, total questions:", updatedQuestions.length);
    console.log("Updated questions array:", updatedQuestions);

    // Update the local state with the filtered array
    setQuiz({ ...quiz, questions: updatedQuestions });
    console.log("Set new quiz state with updated questions array.");
  };

  // When "Start Quiz" is clicked, navigate to the quiz-taking route
  const handleStartQuiz = (quizId: number) => {
    navigate(`/quiz/take/${quizId}`, { state: { quizData: quiz } });
  };

  // When returning to the dashboard, pass the updated quiz (and count) via location state.
  const handleReturnToDashboard = () => {
    if (!quiz) return;
    const updatedCount = quiz.questions.length;
    console.log("Return to Dashboard, updated count:", updatedCount);
    navigate("/saved-quizzes", {
      state: {
        quizData: quiz, // pass the updated quiz object
        updatedCounts: {
          [quiz.quiz_id]: updatedCount, // pass the updated count keyed by quiz_id
        },
      },
    });
  };

  if (loading) return <p>Loading quiz...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!quiz) return <p>No quiz data found.</p>;

  const numQuestions = quiz.questions?.length || 0;

  return (
    <div className="quiz-editor-container">
      {/* A single flex container for the info (left) + buttons (right) */}
      <div className="quiz-header-row">
        {/* Left side: quiz info */}
        <div className="quiz-info">
          <h1>Edit Quiz</h1>
          <h2>Quiz Name {quiz.title}</h2>
          <p>Language: {quiz.language}</p>
          <p>
            {numQuestions} {numQuestions === 1 ? "question" : "questions"}
          </p>
        </div>
  
        {/* Right side: buttons */}
        <div className="quiz-buttons">
          <button 
            className="quiz-btn" 
            onClick={() => handleStartQuiz(Number(quizId))}
          >
            Start Quiz
          </button>
          <button 
            className="quiz-btn" 
            onClick={handleReturnToDashboard} 
            style={{ marginLeft: "1rem" }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
  
      {/* Now render the questions below that row */}
      {quiz.questions.map((question, index) => (
        <QuestionEdit
          key={question.question_id}
          question={question}
          onSave={handleSaveQuestion}
          onDelete={handleDeleteQuestion}
          ordinal={index + 1}
        />
      ))}
    </div>
  );
  
};

export default QuizEditor;
