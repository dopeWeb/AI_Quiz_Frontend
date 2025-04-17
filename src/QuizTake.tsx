import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import axios from "axios";
import QuizDisplay from "./QuizDisplay";
import "./css/QuizGenerator.css";
import "./css/QuizTake.css";
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
  const initialTimeSeconds = timeLimitHours * 3600 + timeLimitMinutes * 60;
  const [timeLeft, setTimeLeft] = useState(initialTimeSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // Shuffle once
  const [hasShuffled, setHasShuffled] = useState(false);

  // Track quiz completion and final score
  const [quizComplete, setQuizComplete] = useState(false);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [finalTotal, setFinalTotal] = useState<number>(0);

  interface ScoreResult {
    score: number;
    total: number; // Add the missing 'total' property
    details: ScoreDetail[];  // includes fields like text_similarity_percentage, etc.
  }

  interface ScoreDetail {
    question_index: number;
    type: string;
    user_answer: string;
    correct_answer: string;
    overall_score?: number;
    text_similarity_percentage?: number;
    semantic_similarity_percentage?: number;
    result: string; 
  }
  
  const [detailedResults, setDetailedResults] = useState<ScoreDetail[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showAnswers] = useState<boolean>(globalShowAnswersProp);



  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
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
    if (!quizDataFromEditor && quizId) {
      axios
        .get(`http://localhost:8000/api/quizzes/${quizId}`, { withCredentials: true })
        .then((res) => {
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
      }
      setLoading(false);
    }
  }, [quizId, quizDataFromEditor]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2) SHUFFLE QUESTIONS ONCE
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quizData) {
      return;
    }
    if (!shuffleQuestions) {
      return;
    }
    if (hasShuffled) {
      return;
    }

    const n = quizData.questions.length;
    if (n < 2) {
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

    setQuizData(updatedQuiz);
    setHasShuffled(true);
  }, [shuffleQuestions, quizData, hasShuffled]);


  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER FUNCTION: API SCORING 
  // ─────────────────────────────────────────────────────────────────────────────
  const computeScoreWithDebug = useCallback(
    async (qData: any, userAnswersParam: string[]): Promise<ScoreResult> => {
      // Build payload for the advanced “open-ended” logic
      const questionsArray = qData.questions.map((q: any) =>
        typeof q === "string" ? q : q.text
      );

      const normalizedAnswers = userAnswersParam.map((a) =>
        a.trim().toLowerCase()
      );
      const correctAnswers = qData.questions.map((q: any) =>
        (q.correct_answer || "").trim().toLowerCase()
      );

      const payload = {
        user_answers: normalizedAnswers,
        correct_answers: correctAnswers,
        quiz_type: qData.quizType || "open-ended",
        questions: questionsArray,
        language: "english",
      };

      console.log("[DEBUG] computeScoreWithDebug payload:", payload);

      // Call your advanced API that returns text/semantic similarity for open-ended
      const response = await axios.post(
        "http://localhost:8000/api/quiz/score",
        payload
      );
      console.log("[DEBUG] forced path scoring response:", response.data);

      const { score, total, details } = response.data;

      // Validate
      const finalScore = typeof score === "number" ? score : 0;
      const finalTotal =
        typeof total === "number" ? total : qData.questions.length;
      const finalDetails = Array.isArray(details) ? details : [];

      return { score: finalScore, total: finalTotal, details: finalDetails };
    },
    [] // no dependencies needed if function only uses its arguments
  );

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
          console.log("[DEBUG] Time is up -> forced scoring");
          clearInterval(timerRef.current!);
          toast.error("Time is up!");
        
          computeScoreWithDebug(quizData, userAnswers)
            .then(({ score, total, details }) => {
              console.log("[DEBUG] forced path -> got score:", score, " details:", details);
              setFinalScore(score);
              setFinalTotal(total);
              setDetailedResults(details);
              setQuizComplete(true);
              setShowReview(true);
            })
            .catch((err) => {
              console.error("[DEBUG] Error in forced path scoring:", err);
            });
        
          return 0;
        }

        const newValue = prev - 1;
        return newValue;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeLimit, initialTimeSeconds, quizComplete, quizData, userAnswers, computeScoreWithDebug]);





  // ─────────────────────────────────────────────────────────────────────────────
  // QUIZ COMPLETE LOGIC
  // ─────────────────────────────────────────────────────────────────────────────


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
        finalScore={`Your score is ${finalScore}/${finalTotal}.`} // Passing string
        detailedResults={detailedResults}  // <--- pass the parent's state
        formattedTime={""} />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NORMAL QUIZ RENDER
  // ─────────────────────────────────────────────────────────────────────────────


  if (loading) {
    return <div>Loading quiz...</div>;
  }
  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }
  if (!quizData) {
    return <div>No quiz data available.</div>;
  }

  return (
    <div className="quiz-take-container">



      <QuizDisplay
        quizData={transformedQuizData}
        quizType={quizType}
        globalShowAnswers={showAnswers}
        userAnswers={userAnswers}
        setUserAnswers={setUserAnswers}
        onQuizComplete={() => {
          stopTimer();
        }}
        stopTimer={stopTimer}
        formattedTime={
          timeLimit
            ? (() => {
                const h = Math.floor(timeLeft / 3600);
                const m = Math.floor((timeLeft % 3600) / 60)
                  .toString()
                  .padStart(2, "0");
                const s = (timeLeft % 60).toString().padStart(2, "0");
                return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
              })()
            : ""
        }

      />


    </div>
  );
};

export default QuizTake;