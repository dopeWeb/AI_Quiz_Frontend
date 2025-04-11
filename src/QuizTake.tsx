import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import axios from "axios";
import QuizDisplay from "./QuizDisplay.tsx";
import "./QuizGenerator.css";
import "./QuizTake.css";
import { toast } from "react-toastify";


const QuizTake: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();

  const {
    quizData: quizDataFromEditor,
    globalShowAnswers: globalShowAnswersProp = true,
    shuffleQuestions = false,
    timeLimit = false,
    timeLimitHours = 0,
    timeLimitMinutes = 0,
  } = (location.state as any) || {};

  const [quizData, setQuizData] = useState<any>(quizDataFromEditor || null);
  const [loading, setLoading] = useState(!quizDataFromEditor);
  const [error, setError] = useState("");

  // Timer
  const initialTimeSeconds = (timeLimitHours * 60 + timeLimitMinutes) * 60;
  const [timeLeft, setTimeLeft] = useState(initialTimeSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // Shuffle once
  const [hasShuffled, setHasShuffled] = useState(false);

  // Track quiz completion and final score
  const [quizComplete, setQuizComplete] = useState(false);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [finalTotal, setFinalTotal] = useState<number>(0);

  // Track review mode
  const [showReview, setShowReview] = useState(false);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);


  const [showAnswers] = useState<boolean>(globalShowAnswersProp);



  // Define a function to stop the timer and freeze the time display.
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      console.log("[DEBUG] Timer stopped via stopTimer function.");
    }
  };

  const handleReview = () => {
    // Check if there are any unanswered questions
    const unanswered = userAnswers.filter(ans => ans.trim() === "").length;
    if (unanswered > 0) {
      const confirmReview = window.confirm(
        `You have ${unanswered} unanswered question(s). Do you still want to review your answers?`
      );
      if (!confirmReview) return;
    }
    console.log("[DEBUG] Review button clicked. Forcing review mode regardless of answers.");
    setShowReview(true);
  };


  useEffect(() => {
    if (quizData && quizData.questions) {
      setUserAnswers(Array(quizData.questions.length).fill(""));
    }
  }, [quizData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1) FETCH QUIZ IF NEEDED
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log("[DEBUG] useEffect -> Checking if we need to fetch quiz data...");
    if (!quizDataFromEditor && quizId) {
      console.log(`[DEBUG] No quizDataFromEditor; fetching quiz with ID = ${quizId}...`);
      axios
        .get(`http://localhost:8000/api/quizzes/${quizId}`, { withCredentials: true })
        .then((res) => {
          console.log("[DEBUG] Fetched quiz data from server:", res.data);
          setQuizData(res.data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("[QuizTake] Error loading quiz data:", err);
          setError("Error loading quiz data.");
          setLoading(false);
        });
    } else {
      if (quizDataFromEditor) {
        console.log("[DEBUG] We already have quizDataFromEditor, no fetch needed:", quizDataFromEditor);
      }
      setLoading(false);
    }
  }, [quizId, quizDataFromEditor]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2) SHUFFLE QUESTIONS ONCE
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quizData) {
      console.log("[DEBUG] No quizData yet, skipping shuffle...");
      return;
    }
    if (!shuffleQuestions) {
      console.log("[DEBUG] shuffleQuestions=false, skipping shuffle...");
      return;
    }
    if (hasShuffled) {
      console.log("[DEBUG] Already shuffled once, skipping shuffle...");
      return;
    }

    console.log("[DEBUG] Shuffling quiz questions...");

    const n = quizData.questions.length;
    if (n < 2) {
      console.log("[DEBUG] Quiz has <2 questions, no need to shuffle.");
      return;
    }

    // Create local copies of the arrays to avoid mutating quizData directly.
    const localQuestions = quizData.questions.slice();
    const localAlternatives = quizData.alternatives ? quizData.alternatives.slice() : [];
    const localAnswers = quizData.answers ? quizData.answers.slice() : [];

    // Create an array of indices and shuffle them using Fisher–Yates shuffle.
    const indices = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Reorder each array using the shuffled indices.
    const shuffledQuestions = indices.map(i => localQuestions[i]);
    const shuffledAlternatives = indices.map(i => localAlternatives[i] || []);
    const shuffledAnswers = indices.map(i => localAnswers[i] || "");

    // If a display object exists, update its arrays as well.
    let updatedDisplay = quizData.display ? { ...quizData.display } : undefined;
    if (updatedDisplay) {
      updatedDisplay.questions = shuffledQuestions.map((q: any) => q.text);
      updatedDisplay.alternatives = quizData.display.alternatives
        ? indices.map(i => quizData.display.alternatives[i])
        : [];
      updatedDisplay.answers = quizData.display.answers
        ? indices.map(i => quizData.display.answers[i])
        : [];
    }

    // Build the updated quiz object.
    const updatedQuiz = {
      ...quizData,
      questions: shuffledQuestions,
      alternatives: shuffledAlternatives,
      answers: shuffledAnswers,
      display: updatedDisplay,
    };

    console.log("[DEBUG] Quiz data after shuffling:", updatedQuiz);

    setQuizData(updatedQuiz);
    setHasShuffled(true);
  }, [shuffleQuestions, quizData, hasShuffled]);


  // ─────────────────────────────────────────────────────────────────────────────
  // TIMER EFFECT (With Debug)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log("[DEBUG] Timer Effect -> Checking conditions...");

    if (!timeLimit || initialTimeSeconds <= 0) {
      console.log("[DEBUG] Timer disabled or initialTimeSeconds <= 0; returning early.");
      return;
    }

    if (quizComplete) {
      console.log("[DEBUG] quizComplete=true. Clearing interval (if any) and returning.");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        console.log("[DEBUG] Cleared timerRef interval due to quizComplete=true.");
      }
      return;
    }

    console.log("[DEBUG] Starting interval for countdown. initialTimeSeconds =", initialTimeSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          console.log("[DEBUG] Time reached 0 or below. Stopping interval and finishing quiz.");
          clearInterval(timerRef.current!);
          toast.error("Time is up!");

          // Compute score and force review mode.
          computeScoreWithDebug(quizData, userAnswers)
            .then((correctCount) => {
              console.log("[DEBUG] Score computed:", correctCount);
              setFinalScore(correctCount);
              setFinalTotal(quizData?.questions?.length || 0);
              // Force review mode instead of a final score screen.
              setQuizComplete(true);
              setShowReview(true);
            })
            .catch((err) => {
              console.error("[DEBUG] Error computing score:", err);
            });
          return 0;
        }

        const newValue = prev - 1;
        console.log(`[DEBUG] Ticking timeLeft from ${prev} to ${newValue}`);
        return newValue;
      });
    }, 1000);

    return () => {
      console.log("[DEBUG] Cleanup -> clearing interval if it exists.");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        console.log("[DEBUG] Cleared interval in cleanup.");
      }
    };
  }, [timeLimit, initialTimeSeconds, quizComplete, quizData, userAnswers]);





  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER FUNCTION: API SCORING (Optional Alternative)
  // ─────────────────────────────────────────────────────────────────────────────
  // If you want to use the API endpoint for scoring instead of local computeScoreWithDebug:
  const computeScoreWithDebug = async (
    qData: any,
    userAnswersParam: string[]
  ): Promise<number> => {
    console.log("[DEBUG] computeScoreWithAPI() -> Scoring quiz via API...");
    if (!qData || !qData.questions) {
      console.log("[DEBUG] computeScoreWithAPI() -> No quiz questions; score=0");
      return 0;
    }

    // Use the provided userAnswers if they exist and are non-empty;
    // otherwise, fall back to using qData.questions[i].answer.
    const effectiveUserAnswers =
      userAnswersParam && userAnswersParam.some(ans => ans.trim() !== "")
        ? userAnswersParam
        : qData.questions.map((q: any) => q.answer || "");

    // Normalize the user answers:
    const normalizedAnswers = effectiveUserAnswers.map((ans: string) =>
      ans ? ans.trim().toLowerCase() : ""
    );

    // Normalize the correct answers:
    const correctAnswers = qData.questions.map((q: any) =>
      q.correct_answer ? q.correct_answer.trim().toLowerCase() : ""
    );

    console.log("[DEBUG] Normalized Answers:", normalizedAnswers);
    console.log("[DEBUG] Correct Answers:", correctAnswers);

    // Build an array of question texts (handling both string and object cases)
    const questionsArray = qData.questions.map((q: any) =>
      typeof q === "string" ? q : q.text
    );

    const payload = {
      user_answers: normalizedAnswers,
      correct_answers: correctAnswers,
      key_concepts: [],
      quiz_type: qData.quizType || "open-ended",
      questions: questionsArray,
      language: "english",
    };

    console.log("[DEBUG] Payload for scoring:", payload);

    try {
      const response = await axios.post("http://localhost:8000/api/quiz/score", payload);
      console.log("[DEBUG] API scoring response:", response.data);
      const score = response.data.score;
      if (typeof score !== "number") {
        console.warn("[DEBUG] Received score is not a number, defaulting to 0");
        return 0;
      }
      return score;
    } catch (err) {
      console.error("[DEBUG] Error scoring quiz via API:", err);
      return 0;
    }
  };




  // ─────────────────────────────────────────────────────────────────────────────
  // QUIZ COMPLETE LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  const handleQuizComplete = (score: number, total: number) => {
    console.log(`[DEBUG] handleQuizComplete() -> score=${score}, total=${total}`);
    setFinalScore(score);
    setFinalTotal(total);
    setQuizComplete(true);
  };

  // If quiz is complete and we are not reviewing, show final screen.
  if (quizComplete && !showReview) {
    const percentage = finalTotal > 0 ? Math.round((finalScore / finalTotal) * 100) : 0;
    console.log("[DEBUG] Rendering quiz-complete screen. Final score:", finalScore, "/", finalTotal);
    return (
      <div className="quiz-complete-container">
        <div className="quiz-complete-icon">
          <div style={{ fontSize: "48px", color: "green" }}>✓</div>
        </div>
        <h2>Quiz Complete</h2>
        <p>
          Your final score is {finalScore}/{finalTotal} ({percentage}%)
        </p>
        <div className="quiz-complete-buttons">
          <button onClick={handleReview}>
            Review
          </button>
          <button onClick={() => window.location.reload()}>
            Restart
          </button>
        </div>
      </div>
    );
  }

  const transformedQuizData = {
    ...quizData,
    title: quizData.quiz_text || "Quiz",
  };

  const quizType = quizData.quiz_type || "open-ended";

  // If in review mode, show the QuizDisplay in review view.
  if (showReview) {
    return (
      <QuizDisplay
        quizData={transformedQuizData}
        quizType={quizType}
        globalShowAnswers={globalShowAnswersProp}
        forceReview={true} // forces review mode
        userAnswers={userAnswers}
        setUserAnswers={setUserAnswers}
        finalScore={`Your score is ${finalScore}`} // <-- Here!
        formattedTime={""}      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NORMAL QUIZ RENDER
  // ─────────────────────────────────────────────────────────────────────────────


  // This function stops the timer and then calls handleFinishManually
  const finishQuizAndStopTimer = async () => {
    console.log("[DEBUG] Finish Quiz button clicked. Manually scoring now...");
    if (!quizData || !quizData.questions) {
      console.log("[DEBUG] quizData or quizData.questions missing. Score=0.");
      handleQuizComplete(0, 0);
      return;
    }

    stopTimer();
    console.log("[DEBUG] Timer manually cleared in finishQuizAndStopTimer.");

    const correctCount = await computeScoreWithDebug(quizData, userAnswers);
    handleQuizComplete(correctCount, quizData.questions.length);
  };
 



  if (loading) {
    return <div>Loading quiz...</div>;
  }
  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }
  if (!quizData) {
    return <div>No quiz data available.</div>;
  }

  console.log("[DEBUG] About to render QuizDisplay with quizData:", quizData);

  return (
    <div className="quiz-take-container">
    

  
      <QuizDisplay
        quizData={transformedQuizData}
        quizType={quizType}
        globalShowAnswers={showAnswers}
        userAnswers={userAnswers}
        setUserAnswers={setUserAnswers}
        onQuizComplete={(score: number, total: number) => {
          console.log(`[DEBUG] onQuizComplete callback from QuizDisplay -> score=${score}, total=${total}`);
          stopTimer();
          handleQuizComplete(score, total);
        }}
        stopTimer={stopTimer}
        formattedTime={initialTimeSeconds > 0 
        ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
        : ""}
      />
  
      <div className="quiz-take-footer">
        <div className="left-buttons">
          <button onClick={finishQuizAndStopTimer} className="quiz-take-btn finish-btn">
            Finish Quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizTake;
