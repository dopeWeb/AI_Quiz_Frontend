import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import QuestionEdit from "./QuestionEdit.tsx";
import "./EditQuiz.css";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { toast, ToastContainer,  } from "react-toastify";


interface QuizDisplayData {
  questions: string[];            // Text for each question
  alternatives: string[][];       // An array of alternatives for each question
  answers: string[];              // The correct answer for each question
  question_types?: ("MC" | "TF" | "OE")[]; // (Optional) per-question types
}

interface Question {
  question_id: number;
  order?: number; // Optional property
  display_order?: number; // Optional property for backend compatibility
  question_type: "MC" | "TF" | "OE";
  text: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;

}

interface Quiz {
  quizType: "multiple-choice" | "true-false" | "open-ended" | "mixed";
  quiz_id: number;
  title: string;
  language: string;
  created_at: string;
  questions: Question[];
  display: QuizDisplayData;
}


const QuizEditor: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Settings (master values)
  const [showAnswers, setShowAnswers] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [timeLimit, setTimeLimit] = useState(false);
  const [timeLimitHours, setTimeLimitHours] = useState<number>(0);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(0);

  const [isDirty, setIsDirty] = useState(false);


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


  useEffect(() => {
    if (!quizId) return;
    axios
      .get(`http://localhost:8000/api/quizzes/${quizId}`, { withCredentials: true })
      .then((res) => {
        setQuiz(res.data);
        setLoading(false);
        // Assume that initially there are no unsaved changes.
        setIsDirty(false);
      })
      .catch((_err) => {
        setError("Error loading quiz data");
        setLoading(false);
      });
  }, [quizId]);



  const handleSaveQuestion = (updatedQ: Question) => {
    if (!quiz) return;

    // Update the main questions array.
    const updatedQuestions = quiz.questions.map((q) =>
      q.question_id === updatedQ.question_id ? updatedQ : q
    );

    // Make a copy of the display object if it exists.
    let updatedDisplay = quiz.display ? { ...quiz.display } : undefined;
    const questionIndex = quiz.questions.findIndex(
      (q) => q.question_id === updatedQ.question_id
    );

    // Update display.answers if available.
    if (updatedDisplay && Array.isArray(updatedDisplay.answers)) {
      const updatedAnswers = [...updatedDisplay.answers];
      updatedAnswers[questionIndex] = updatedQ.correct_answer || "";
      updatedDisplay = {
        ...updatedDisplay,
        answers: updatedAnswers,
        questions: updatedQuestions.map((q: any) => q.text),
      };
    }

    // Update display.alternatives if available.
    if (updatedDisplay && Array.isArray(updatedDisplay.alternatives)) {
      const updatedAlternatives = [...updatedDisplay.alternatives];
      if (updatedQ.question_type === "MC") {
        // For multiple choice, set alternatives from options.
        updatedAlternatives[questionIndex] = [
          updatedQ.option_a || "",
          updatedQ.option_b || "",
          updatedQ.option_c || "",
          updatedQ.option_d || ""
        ];
      } else if (updatedQ.question_type === "TF") {
        // For true/false, force alternatives to be True/False.
        updatedAlternatives[questionIndex] = ["True", "False"];
      } else {
        // For open-ended, you might leave it empty.
        updatedAlternatives[questionIndex] = [];
      }
      updatedDisplay = {
        ...updatedDisplay,
        alternatives: updatedAlternatives,
      };
    }

    // Build the updated quiz object.
    const updatedQuiz = {
      ...quiz,
      questions: updatedQuestions,
      display: updatedDisplay ? updatedDisplay : quiz.display,
    };

    console.log("Updated quiz state:", updatedQuiz);
    setQuiz(updatedQuiz);
  };


  const handleSaveAllBulk = async () => {
    if (!quiz) return;
    try {
      const csrftoken = getCookie("csrftoken");
      // Build array of updated questions from the local state.
      const questionsPayload = quiz.questions.map((question) => {
        let finalCorrect = "";
        if (question.question_type === "MC") {
          finalCorrect = question.correct_answer ? question.correct_answer.toUpperCase() : "";
        } else if (question.question_type === "TF") {
          finalCorrect =
            question.correct_answer && question.correct_answer.toLowerCase() === "false"
              ? "False"
              : "True";
        } else {
          finalCorrect = question.correct_answer || "";
        }
        return {
          ...question,
          correct_answer: finalCorrect,
        };
      });

      const response = await axios.put(
        `http://localhost:8000/api/questions/bulk_update/`,
        { questions: questionsPayload },
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrftoken || "" },
        }
      );
      console.log("Bulk update response:", response.data);
     toast.success("All questions saved successfully." ,{ containerId: "local" });
    } catch (error) {
      console.error("Error in bulk saving questions:", error);
      toast.error("Error saving all questions. Please try again.",{ containerId: "local" });
    }
  };





  const handleDeleteQuestion = (deletedId: number) => {
    if (!quiz) return;

    // Remove the question from the main questions array.
    const updatedQuestions = quiz.questions.filter(
      (q) => q.question_id !== deletedId
    );

    // Determine the index of the deleted question (from the old array)
    const deleteIndex = quiz.questions.findIndex(
      (q) => q.question_id === deletedId
    );

    // If the display object exists and the answers/questions arrays are present,
    // remove the corresponding element.
    let updatedDisplay = quiz.display ? { ...quiz.display } : undefined;
    if (updatedDisplay) {
      if (
        Array.isArray(updatedDisplay.answers) &&
        updatedDisplay.answers.length > deleteIndex
      ) {
        const updatedAnswers = [...updatedDisplay.answers];
        updatedAnswers.splice(deleteIndex, 1);
        updatedDisplay.answers = updatedAnswers;
      }
      if (
        Array.isArray(updatedDisplay.questions) &&
        updatedDisplay.questions.length > deleteIndex
      ) {
        const updatedDisplayQuestions = [...updatedDisplay.questions];
        updatedDisplayQuestions.splice(deleteIndex, 1);
        updatedDisplay.questions = updatedDisplayQuestions;
      }
      // If you also store alternatives in display, do the same:
      if (
        Array.isArray(updatedDisplay.alternatives) &&
        updatedDisplay.alternatives.length > deleteIndex
      ) {
        const updatedDisplayAlternatives = [...updatedDisplay.alternatives];
        updatedDisplayAlternatives.splice(deleteIndex, 1);
        updatedDisplay.alternatives = updatedDisplayAlternatives;
      }
    }

    // Build the updated quiz object.
    const updatedQuiz = {
      ...quiz,
      questions: updatedQuestions,
      display: updatedDisplay ? updatedDisplay : quiz.display,
    };

    console.log("Updated quiz state after deletion:", updatedQuiz);
    setQuiz(updatedQuiz);
  };



  const fetchQuizData = async () => {
    try {
      const response = await axios.get(`http://localhost:8000/api/quizzes/${quizId}`, { withCredentials: true });
      return response.data;
    } catch (err) {
      console.error("Error fetching updated quiz data:", err);
      return quiz;
    }
  };





  const handleStartQuiz = async (quizId: number) => {
    if (!quiz) return;

    if (isDirty) {
      toast.error("You have unsaved changes. Please click 'Save All' before starting the quiz.",{ containerId: "local" });
      return;
    }
    // Optionally re-fetch the quiz data from the backend.
    const updatedQuiz = await fetchQuizData();
    navigate(`/quiz/take/${quizId}`, {
      state: {
        quizData: updatedQuiz,
        showAnswers,
        globalShowAnswers: showAnswers,
        shuffleQuestions,
        timeLimit,
        timeLimitHours,
        timeLimitMinutes,
      },
    });
  };

  const handleReturnToDashboard = () => {
    if (!quiz) return;
    const updatedCount = quiz.questions.length;
    navigate("/saved-quizzes", {
      state: {
        quizData: quiz,
        updatedCounts: {
          [quiz.quiz_id]: updatedCount,
        },
      },
    });
  };

  const handleSaveOrder = async (updatedQuizData: Quiz) => {
    if (!updatedQuizData) return;
    try {
      const csrftoken = getCookie("csrftoken");
      console.log("[DEBUG] Bulk order update payload:",
        updatedQuizData.questions.map((q, index) => ({
          question_id: q.question_id,
          display_order: index,
        }))
      );

      const response = await axios.put(
        `http://localhost:8000/api/questions/bulk_update_order/`,
        {
          updates: updatedQuizData.questions.map((q, index) => ({
            question_id: q.question_id,
            display_order: index,
          }))
        },
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrftoken || "" },
        }
      );
      console.log("Bulk order update response:", response.data);
    } catch (error: any) {
      console.error("Error updating question order:", error);
      if (error.response) {
        console.error("[DEBUG] Error response data:", error.response.data);
        console.error("[DEBUG] Error response status:", error.response.status);
      }
      toast.error("Error updating question order. Please try again.",{ containerId: "local" });
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !quiz) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    // Reorder the main questions array.
    const reorderedQuestions = Array.from(quiz.questions);
    const [removedQuestion] = reorderedQuestions.splice(sourceIndex, 1);
    reorderedQuestions.splice(destIndex, 0, removedQuestion);

    // Now, update the display arrays (if they exist).
    const currentDisplay = quiz.display || {};
    const displayQuestions = currentDisplay.questions ? Array.from(currentDisplay.questions) : [];
    if (displayQuestions.length > 0) {
      const [removedText] = displayQuestions.splice(sourceIndex, 1);
      displayQuestions.splice(destIndex, 0, removedText);
    }
    const displayAlternatives = currentDisplay.alternatives ? Array.from(currentDisplay.alternatives) : [];
    if (displayAlternatives.length > 0) {
      const [removedAlt] = displayAlternatives.splice(sourceIndex, 1);
      displayAlternatives.splice(destIndex, 0, removedAlt);
    }
    const displayAnswers = currentDisplay.answers ? Array.from(currentDisplay.answers) : [];
    if (displayAnswers.length > 0) {
      const [removedAns] = displayAnswers.splice(sourceIndex, 1);
      displayAnswers.splice(destIndex, 0, removedAns);
    }
    const displayQuestionTypes = currentDisplay.question_types ? Array.from(currentDisplay.question_types) : [];
    if (displayQuestionTypes.length > 0) {
      const [removedType] = displayQuestionTypes.splice(sourceIndex, 1);
      displayQuestionTypes.splice(destIndex, 0, removedType);
    }
    const updatedDisplay = {
      ...currentDisplay,
      questions: displayQuestions,
      alternatives: displayAlternatives,
      answers: displayAnswers,
      question_types: displayQuestionTypes,
    };

    // Build the updated quiz object.
    const updatedQuiz = {
      ...quiz,
      questions: reorderedQuestions,
      display: updatedDisplay,
    };

    console.log("[DEBUG] Updated quiz data after drag:", updatedQuiz);
    setQuiz(updatedQuiz);

    // Pass the newly computed quiz object to persist the new order.
    handleSaveOrder(updatedQuiz);
  };






  if (loading) return <p>Loading quiz...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!quiz) return <p>No quiz data found.</p>;

  const numQuestions = quiz.questions?.length || 0;

  return (

    <><ToastContainer
      containerId="local"
      position="top-right"
      autoClose={1000}
      hideProgressBar={true}
      newestOnTop={true}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      aria-label="Local Toast Container" />
      <div className="quiz-editor-container">
        <div className="quiz-header-row">
          <div className="quiz-info">
            <h1>Edit Quiz</h1>
            <h2>Quiz Name: {quiz.title}</h2>
            <p>
              {numQuestions} {numQuestions === 1 ? "question" : "questions"}
            </p>
          </div>

          <div className="quiz-buttons">
            <button className="quiz-btn" onClick={() => handleStartQuiz(Number(quizId))}>
              Start Quiz
            </button>
            <button className="quiz-btn" onClick={handleReturnToDashboard} style={{ marginLeft: "1rem" }}>
              Return to Dashboard
            </button>
            <button className="quiz-btn" onClick={handleSaveAllBulk} style={{ marginLeft: "1rem" }}>
              Save All
            </button>
          </div>
        </div>

        {/* Settings Row – Only here in QuizEditor */}
        <div className="quiz-settings-row">
          <label className="quiz-setting">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)} />
            Show Answers
          </label>

          <label className="quiz-setting">
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)} />
            Shuffle Questions
          </label>

          <label className="quiz-setting">
            <input
              type="checkbox"
              checked={timeLimit}
              onChange={(e) => setTimeLimit(e.target.checked)} />
            Time Limit
          </label>

          {(timeLimit || timeLimitHours > 0 || timeLimitMinutes > 0) && (
            <div className="time-limit-inputs">
              <label>
                Hours:
                <input
                  type="number"
                  value={timeLimitHours}
                  onChange={(e) => {
                    const hours = Number(e.target.value);
                    setTimeLimitHours(hours);
                    if (hours > 0 || timeLimitMinutes > 0) {
                      setTimeLimit(true);
                    }
                  } }
                  min={0} />
              </label>
              <label>
                Minutes:
                <input
                  type="number"
                  value={timeLimitMinutes}
                  onChange={(e) => {
                    const minutes = Number(e.target.value);
                    setTimeLimitMinutes(minutes);
                    if (minutes > 0 || timeLimitHours > 0) {
                      setTimeLimit(true);
                    }
                  } }
                  min={0}
                  max={59} />
              </label>
            </div>
          )}


        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="questions">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {quiz.questions.map((question, index) => (
                  <QuestionEdit
                    key={question.question_id}
                    question={question}
                    onSave={handleSaveQuestion}
                    onDelete={handleDeleteQuestion}
                    onChange={handleSaveQuestion} //
                    ordinal={index + 1} />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div></>
  );
};



export default QuizEditor;
