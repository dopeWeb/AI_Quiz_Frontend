import React, { useState, } from "react";
import axios from "axios";
import styles from "./css/QuizDisplay.module.css";
import { toast } from "react-toastify";

interface QuizQuestion {
  question_id: number;
  text: string;
  question_type: "MC" | "TF" | "OE"; // "MC": Multiple Choice, "TF": True/False, "OE": Open Ended
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer: string;
  answer?: string; // user’s input
}

// Updated QuizData interface to reflect that questions are objects.
interface QuizData {
  alternatives: string[][];
  answers: string[];
  display: {
    questions: string[];      // e.g. ["Question 1", "Question 2", ...]
    alternatives: string[][]; // Array of alternatives for each question
    answers: string[];        // Correct answers (e.g. "a", "true", etc.)
    question_types?: ("MC" | "TF" | "OE")[]; // Optional per-question types for mixed quizzes
  };
  questions: QuizQuestion[];  // Now each question is a QuizQuestion object.
  quizType: "multiple-choice" | "true-false" | "open-ended" | "mixed";
}

interface ScoreDetail {
  question_index: number;
  type: string;
  user_answer: string;
  correct_answer: string;
  overall_score?: number;
  text_similarity_percentage?: number;
  semantic_similarity_percentage?: number;
  result: string; // "correct", "partially correct", or "incorrect"
}

interface Props {
  quizData: QuizData;
  quizType: "multiple-choice" | "true-false" | "open-ended" | "mixed";
  forceReview?: boolean;
  globalShowAnswers?: boolean; // Add this property to match the usage
  onQuizComplete?: (score: number, total: number) => void;
  updateQuestionAnswer?: (index: number, userVal: string) => void;
  stopTimer?: () => void; // <-- New prop
  finalScore?: string; // Added finalScore here
  userAnswers?: string[];
  setUserAnswers?: (answers: string[]) => void;
  formattedTime?: string;
  onTimerClose?: () => void;
  detailedResults?: ScoreDetail[];


}

const getEffectiveType = (
  index: number,
  globalQuizType: "multiple-choice" | "true-false" | "open-ended" | "mixed",
  quizData: QuizData
): "multiple-choice" | "true-false" | "open-ended" => {
  // If the question object has a specific type, use it.
  if (quizData.questions && quizData.questions[index] && quizData.questions[index].question_type) {
    const qt = quizData.questions[index].question_type;
    if (qt === "MC") return "multiple-choice";
    if (qt === "TF") return "true-false";
    if (qt === "OE") return "open-ended";
  }
  // Also check in the display if available.
  if (quizData.display && quizData.display.question_types && quizData.display.question_types[index]) {
    const qt = quizData.display.question_types[index];
    if (qt === "MC") return "multiple-choice";
    if (qt === "TF") return "true-false";
    if (qt === "OE") return "open-ended";
  }
  // Fallback: use the global type as is.
  // Fallback: if globalQuizType is "mixed", default to "multiple-choice"
  return globalQuizType === "mixed" ? "multiple-choice" : globalQuizType;
};


/**
 * Helper function to get the alternatives for a given question index based on its effective type.
 */
const getCurrentAlternativesForIndex = (
  index: number,
  globalQuizType: "multiple-choice" | "true-false" | "open-ended" | "mixed",
  quizData: QuizData,
  alternatives: string[][]
): string[] => {
  const effectiveType = getEffectiveType(index, globalQuizType, quizData);
  if (effectiveType === "true-false") {
    return ["True", "False"];
  }
  if (effectiveType === "multiple-choice") {
    // Get the alternatives for this question.
    const currentAlts = (alternatives && alternatives[index]) || [];
    // Ensure there are exactly 4 items.
    const filled = [...currentAlts];
    while (filled.length < 4) {
      filled.push(""); // Fill with empty string (or you can use a placeholder like "N/A")
    }
    // If there are more than 4, take only the first 4.
    return filled.slice(0, 4);
  }
  // For open-ended or other types, return as-is.
  if (
    (effectiveType === "open-ended") &&
    alternatives &&
    alternatives[index] &&
    Array.isArray(alternatives[index])
  ) {
    return alternatives[index];
  }
  return [];
};


function QuizDisplay({
  quizData,
  quizType,
  stopTimer,
  forceReview,
  userAnswers = [],
  setUserAnswers,
  finalScore = "",
  globalShowAnswers = true, // Default to false if not provided
  formattedTime,
  detailedResults = [],


}: Props) {



  let questions: string[] = [];
  let alternatives: string[][] = [];
  let answers: string[] = [];

  if (quizData.display) {
    questions = quizData.display.questions || [];
    alternatives = quizData.display.alternatives || [];
    answers = quizData.display.answers || [];
  } else {
    questions =
      quizData.questions?.map((q: any) =>
        typeof q === "string" ? q : q.text
      ) || [];
    alternatives = quizData.alternatives || [];
    answers = quizData.answers || [];
  }

  const totalQuestions = questions.length;



  // Use the provided props if available, otherwise fall back to local state.
  const [localUserAnswers, localSetUserAnswers] = useState<string[]>(
    Array(totalQuestions).fill("")
  );
  
  // If the parent provided userAnswers/setUserAnswers, use them. Otherwise fallback to local
  const effectiveUserAnswers =
    userAnswers && userAnswers.length > 0 ? userAnswers : localUserAnswers;
  
  const effectiveSetUserAnswers =
    typeof setUserAnswers === "function" ? setUserAnswers : localSetUserAnswers;

  // Other local states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [LocalfinalScore, setFinalScore] = useState<string | null>(null);
  const [LoacldetailedResults, setDetailedResults] = useState<ScoreDetail[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [showAnswer, setShowAnswer] = useState<boolean[]>(
    Array(totalQuestions).fill(false)
  );
  const [openEndedFeedback, setOpenEndedFeedback] = useState<ScoreDetail | null>(null);



  const currentAlternatives = getCurrentAlternativesForIndex(
    currentIndex,
    quizType,
    quizData,
    alternatives
  );
  console.log("[DEBUG] currentAlternatives for question", currentIndex, ":", currentAlternatives);

  const getQuestionText = (question: string | { text: string }): string => {
    return typeof question === "object" && question.text ? question.text : question as string;
  };

  // Update selection using the effective props/state
  const handleSelectOption = (val: string) => {
    if (locked) {
      console.log("[DEBUG] Option locked, cannot change.");
      return;
    }
  
    console.log("[DEBUG] handleSelectOption called with:", val, " for question:", currentIndex);
  
    // Update only localUserAnswers (a draft)
    const newLocal = [...localUserAnswers];
    newLocal[currentIndex] = val;
    localSetUserAnswers(newLocal);
  
    console.log("[DEBUG] localUserAnswers updated (draft):", newLocal);
  };
  
  /************************************************
   * 3) handleOpenEndedChange -> only updates localUserAnswers
   ************************************************/
  const handleOpenEndedChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (locked) {
      console.log("[DEBUG] This answer is locked, ignoring typed input.");
      return;
    }
  
    console.log("[DEBUG] handleOpenEndedChange, text:", e.target.value, " for Q:", currentIndex);
  
    // Update only localUserAnswers (a draft)
    const newLocal = [...localUserAnswers];
    newLocal[currentIndex] = e.target.value;
    localSetUserAnswers(newLocal);
  
    console.log("[DEBUG] localUserAnswers updated (draft):", newLocal);
  };

  const handleLockAnswer = async () => {
    console.log("[DEBUG] handleLockAnswer -> copying localAnswers to official userAnswers for Q:", currentIndex);
  
    setLocked(true);
  
    // 1) Copy from localUserAnswers to userAnswers
    const newAnswers = [...effectiveUserAnswers];
    newAnswers[currentIndex] = localUserAnswers[currentIndex];
    effectiveSetUserAnswers(newAnswers);   // official commit
  
    console.log("[DEBUG] userAnswers after lock:", newAnswers);
  
    // 2) If open-ended, do scoring using newAnswers[currentIndex]
    const effectiveType = getEffectiveType(currentIndex, quizType, quizData);
    if (effectiveType === "open-ended") {
      try {
        const payload = {
          user_answers: [newAnswers[currentIndex]],
          correct_answers: [answers[currentIndex]],
          quiz_type: "open-ended",
          questions: [questions[currentIndex]],
          language: "english",
        };
        const response = await axios.post("http://localhost:8000/api/quiz/score", payload);
        setOpenEndedFeedback(response.data.details[0]);
        console.log("[DEBUG] Open-ended scoring response:", response.data);
      } catch (err) {
        console.error("Error evaluating open-ended answer:", err);
        toast.error("Error evaluating answer. Please try again.");
      }
    } else {
      console.log("[DEBUG] Answer locked for a non-open-ended question.");
    }
  };




  const handleNext = () => {
    setLocked(false);
    setCurrentIndex(currentIndex + 1);
    setOpenEndedFeedback(null);
  };

  const handleFinish = async () => {
    try {
      if (stopTimer) {
        stopTimer();
        console.log("[DEBUG] stopTimer called from QuizDisplay.handleFinish");
      }

      // Log the entire effectiveUserAnswers array before normalization
      console.log("[DEBUG] effectiveUserAnswers before normalization:", effectiveUserAnswers);

      // Use effectiveUserAnswers so that you get the actual picks
      const normalizedAnswers = effectiveUserAnswers.map((answer, i) => {
        const effType = getEffectiveType(i, quizType, quizData);
        console.log(
          `[DEBUG] Normalizing Q#${i + 1} userAnswer="${answer}" (type=${effType})`
        );

        if (effType === "multiple-choice") {
          // Minimal approach: store user’s letter or text, then just toLowerCase
          const normalized = answer.trim().toLowerCase();
          console.log(
            `[DEBUG] Q#${i + 1} multiple-choice -> normalized="${normalized}"`
          );
          return normalized;

        } else if (effType === "true-false") {
          // For T-F, uppercase for scoring
          const normalized = answer.trim().toUpperCase();
          console.log(
            `[DEBUG] Q#${i + 1} true-false -> normalized="${normalized}"`
          );
          return normalized;

        } else {
          // For open-ended, do a simple trim & lowercase
          const normalized = answer.trim().toLowerCase();
          console.log(
            `[DEBUG] Q#${i + 1} open-ended -> normalized="${normalized}"`
          );
          return normalized;
        }
      });

      // Also log the normalizedAnswers array to see the final results
      console.log("[DEBUG] normalizedAnswers:", normalizedAnswers);

      // Build your payload
      const payload = {
        user_answers: normalizedAnswers,
        correct_answers: answers.map(a => a.trim().toLowerCase()),
        quiz_type: quizType,
        questions: questions,
        language: "english",
      };
      console.log("[DEBUG] Payload for scoring:", payload);

      const response = await axios.post("http://localhost:8000/api/quiz/score", payload);
      console.log("[DEBUG] API scoring response:", response.data);

      let details = response.data.details;
      if (Array.isArray(details)) {
        details = details.map((detail: any) => {
          const qIdx = detail.question_index;
          const qType = getEffectiveType(qIdx, quizType, quizData);
          console.log("[DEBUG] Forced Review -> Q#" + (qIdx + 1) + " is recognized as:", qType);


          // If open-ended, keep similarity fields; otherwise strip them
          if (qType === "open-ended") {
            // Keep text_similarity_percentage, semantic_similarity_percentage, etc.
            return detail;
          } else {
            // strip them out
            const {
              text_similarity_percentage,
              semantic_similarity_percentage,
              overall_score,
              ...rest
            } = detail;
            return rest;
          }
        });
      }

      setFinalScore(`Your score is ${response.data.score}/${response.data.total}.`);
      setDetailedResults(response.data.details);
      setReviewMode(true);

    } catch (err) {
      console.error("Error finishing quiz:", err);
      toast.error("Error finishing quiz. Please try again.");
    }
  };

  const toggleShowAnswer = (index: number) => {
    const updated = [...showAnswer];
    updated[index] = !updated[index];
    setShowAnswer(updated);
  };






  if (forceReview || reviewMode) {
    console.log("[DEBUG] In REVIEW MODE. finalScore:", finalScore, "forceReview:", forceReview);
    return (
      <div className={styles.reviewContainer}>
        <h2>{finalScore}</h2>
        <h2>{LocalfinalScore}</h2>
        <p>Review of all questions:</p>
        {questions.map((qText, i) => {
          const effectiveType = getEffectiveType(i, quizType, quizData);
          const correctAnswer = answers[i] || "";
          const userAnswer = effectiveUserAnswers[i] || "";
          const displayedUserAnswer = userAnswer.trim() === "" ? "Not answered" : userAnswer;

          const detail =
          detailedResults.find(d => d.question_index === i && d.type === effectiveType) ||
          LoacldetailedResults.find((d) => d.question_index === i);

          console.log("[DEBUG] detail for question i=", i, detail);



          // For MC or TF, gather alternatives
          let theseAlternatives: string[] = [];
          if (effectiveType === "true-false") {
            theseAlternatives = ["True", "False"];
          } else if (effectiveType === "multiple-choice") {
            theseAlternatives = alternatives[i] || [];
          }

          // Determine user letter & correct letter for MC
          let userLetter = -1;
          let correctLetter = -1;
          if (effectiveType === "multiple-choice" && theseAlternatives.length > 0) {
            userLetter = theseAlternatives.findIndex(
              (opt) => (opt || "").trim().toLowerCase() === userAnswer.trim().toLowerCase()
            );
            correctLetter = theseAlternatives.findIndex(
              (opt) => (opt || "").trim().toLowerCase() === correctAnswer.trim().toLowerCase()
            );
          }

          // Helper for TF capitalization (first letter uppercase)
          const capitalizeFirst = (str: string): string => {
            if (!str) return "";
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
          };

          return (
            <div key={i} className={styles.questionCardReview}>
              <h3>
                {i + 1}) {qText}
              </h3>

              {effectiveType === "multiple-choice" ? (
                <>
                  <p>
                    <strong>Your Answer:</strong>{" "}
                    {userLetter >= 0
                      ? String.fromCharCode(65 + userLetter)
                      : (userAnswer
                        ? userAnswer.toUpperCase()
                        : displayedUserAnswer
                      )
                    }

                  </p>
                  <p>
                    <strong>Correct Answer:</strong>{" "}
                    {correctLetter >= 0
                      ? String.fromCharCode(65 + correctLetter)
                      : correctAnswer.toUpperCase() /* force uppercase */}
                  </p>
                </>
              ) : effectiveType === "true-false" ? (
                <>
                  <p>
                    <strong>Your Answer:</strong>{" "}
                    {capitalizeFirst(displayedUserAnswer) /* First letter uppercase */}
                  </p>
                  <p>
                    <strong>Correct Answer:</strong>{" "}
                    {capitalizeFirst(correctAnswer)}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Your Answer:</strong>{" "}
                    {userAnswer.trim() === "" ? "Not answered" : userAnswer}
                  </p>
                  <p className={styles.answerBox}>

                    <strong>Correct Answer:</strong> {correctAnswer}
                  </p>

                  {userAnswer.trim() !== "" && detail && (
                    <>
                      <p>
                        <strong>Text Similarity Percentage:</strong>{" "}
                        {detail.text_similarity_percentage ?? 0}%
                      </p>
                      <p>
                        <strong>Semantic Similarity Percentage:</strong>{" "}
                        {detail.semantic_similarity_percentage ?? 0}%
                      </p>
                      <p>
                        <strong>Overall Score:</strong>{" "}
                        {detail.overall_score ?? 0}
                      </p>
                      <p
                        className={
                          detail.result === "correct"
                            ? styles.correctOption
                            : detail.result === "partially correct"
                              ? styles.partialOption
                              : styles.incorrectOption
                        }
                      >
                        {detail.result === "correct"
                          ? "Correct!"
                          : detail.result === "partially correct"
                            ? "Partially Correct"
                            : "Incorrect"}
                      </p>
                    </>
                  )}
                </>
              )}

              {/* If multiple-choice or TF, show all alternatives with highlight */}
              {(effectiveType === "multiple-choice" || effectiveType === "true-false") &&
                theseAlternatives.length > 0 &&
                theseAlternatives.map((optionText, idx) => {
                  const letter = String.fromCharCode(97 + idx);
                  let appliedStyle = `${styles.optionBase}`;

                  if (
                    letter === correctAnswer.toLowerCase() ||
                    (optionText || "").trim().toLowerCase() ===
                    correctAnswer.trim().toLowerCase()
                  ) {
                    appliedStyle = `${styles.optionBase} ${styles.correctOption}`;
                  } else if (
                    (userAnswer.toLowerCase() === letter &&
                      letter !== correctAnswer.toLowerCase()) ||
                    (userAnswer.toLowerCase() === (optionText || "").trim().toLowerCase() &&
                      (optionText || "").trim().toLowerCase() !==
                      correctAnswer.trim().toLowerCase())
                  ) {
                    appliedStyle = `${styles.optionBase} ${styles.incorrectOption}`;
                  }
                  return (
                    <div key={letter} className={appliedStyle}>
                      <div className={styles.letterBox}>{letter.toUpperCase()}</div>
                      <div>{optionText}</div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    );
  }


  const canLock = (localUserAnswers[currentIndex]?.trim() ?? "") !== "";
  const currentQuestion = questions[currentIndex];
  const currentCorrectAnswer = answers[currentIndex];
  const userChoice = localUserAnswers[currentIndex] || "";
  const effectiveType = getEffectiveType(currentIndex, quizType, quizData);
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const progressPercentage = ((currentIndex + 1) / totalQuestions) * 100;
  const handleTimerClose = () => {
    window.location.href = "http://localhost:3000/saved-quizzes";
  };


  // Build a "safe" alternatives array
  let safeCurrentAlternatives: string[] = [];
  if (effectiveType === "true-false") {
    safeCurrentAlternatives = ["True", "False"];
  } else if (effectiveType === "multiple-choice") {
    safeCurrentAlternatives = getCurrentAlternativesForIndex(
      currentIndex,
      quizType,
      quizData,
      alternatives
    );
  }


  return (

    <div className={styles.container}>

      <div className={styles.timerContainer}>
        <span className={styles.timerClose} onClick={handleTimerClose}>X</span>
        <span className={styles.timerDisplay}>{formattedTime}</span>
        <div className={styles.progressBar}>
        <div className={styles.timerFill} style={{ width: `${progressPercentage}%` }}></div>
        </div>
        <span className={styles.timerCount}>
          {currentIndex + 1}/{totalQuestions}
        </span>
      </div>

      <div className={styles.questionCard}>
        <h3>{currentIndex + 1}) {getQuestionText(currentQuestion)}</h3>
        {(effectiveType === "multiple-choice" && safeCurrentAlternatives.length > 0) ? (
          safeCurrentAlternatives.map((optionText, idx) => {
            const letter = String.fromCharCode(97 + idx);
            const isSelected = userChoice.toLowerCase() === letter;

            // Start with the base style.
            let appliedStyle = styles.optionBase;

            // Always add a "selected" style if this option is chosen.
            if (isSelected) {
              appliedStyle += " " + styles.selectedOption;
            }

            // Only reveal feedback if the answer is locked AND "Show Answers" is enabled.
            if (locked && globalShowAnswers) {
              if (letter === currentCorrectAnswer.toLowerCase()) {
                // Correct option styling overrides selected style.
                appliedStyle = `${styles.optionBase} ${styles.correctOption}`;
              } else if (isSelected) {
                appliedStyle = `${styles.optionBase} ${styles.incorrectOption}`;
              }
            }

            // Prevent re-selecting once locked.
            const onClickHandler = () => {
              if (!locked) {
                handleSelectOption(letter);
              }
            };

            console.log(
              `[DEBUG] MC Option ${letter.toUpperCase()} for Q${currentIndex + 1}: isSelected=${isSelected}, locked=${locked}, globalShowAnswers=${globalShowAnswers}, appliedStyle=${appliedStyle}`
            );

            return (
              <div key={letter} className={appliedStyle} onClick={onClickHandler}>
                <div className={styles.letterBox}>{letter.toUpperCase()}</div>
                <div>{optionText}</div>
              </div>
            );
          })
        ) : (effectiveType === "true-false" && safeCurrentAlternatives.length > 0) ? (
          safeCurrentAlternatives.map((optionText, idx) => {
            const tfValue = idx === 0 ? "True" : "False";
            const isSelected = userChoice === tfValue;
            let appliedStyle = styles.optionBase;
            if (isSelected) {
              appliedStyle += " " + styles.selectedOption;
            }
            if (locked && globalShowAnswers) {
              if (tfValue.toLowerCase() === currentCorrectAnswer.toLowerCase()) {
                appliedStyle = `${styles.optionBase} ${styles.correctOption}`;
              } else if (isSelected) {
                appliedStyle = `${styles.optionBase} ${styles.incorrectOption}`;
              }
            }
            const onClickHandler = () => {
              if (!locked) {
                handleSelectOption(tfValue);
              }
            };
            console.log(
              `[DEBUG] TF Option ${tfValue} for Q${currentIndex + 1}: isSelected=${isSelected}, locked=${locked}, globalShowAnswers=${globalShowAnswers}, appliedStyle=${appliedStyle}`
            );
            return (
              <div key={tfValue} className={appliedStyle} onClick={onClickHandler}>
                <div className={styles.letterBox}>
                  {tfValue.substring(0, 1).toUpperCase()}
                </div>
                <div>{optionText}</div>
              </div>
            );
          })
        ) : null}


        {/* For open-ended */}
        {effectiveType === "open-ended" && (
          <>
            <div className={styles.openEndedContainer}>
              <textarea
                placeholder="Enter your answer"
                value={userChoice}
                onChange={handleOpenEndedChange}
                className={styles.textareaBox}
              />

              <button
                onClick={() => toggleShowAnswer(currentIndex)}
                className={styles.toggleButton}
              >
                {showAnswer[currentIndex] ? "Hide Answer" : "Show Answer"}
              </button>

              {showAnswer[currentIndex] && (
                <p className={styles.answerBox}>
                  <strong>Correct Answer:</strong> {currentCorrectAnswer}
                </p>
              )}

              {locked && openEndedFeedback && globalShowAnswers && (
                <p
                  className={
                    openEndedFeedback.result === "correct"
                      ? styles.correctOption
                      : openEndedFeedback.result === "partially correct"
                        ? styles.partialOption
                        : styles.incorrectOption
                  }
                >
                  {openEndedFeedback.result === "correct"
                    ? "Correct!"
                    : openEndedFeedback.result === "partially correct"
                      ? "Partially Correct"
                      : "Incorrect"}
                </p>
              )}
            </div>
          </>
        )}
      </div>



      {/* Footer Buttons */}
      {
        !locked ? (
          <button
            onClick={handleLockAnswer}
            disabled={!canLock}
            className={styles.lockButton}
          >
            Lock Answer
          </button>
        ) : (
          <>
            {currentIndex < totalQuestions - 1 && (
              <button onClick={handleNext} className={styles.nextButton}>
                Next →
              </button>
            )}
            {isLastQuestion && (
              <button onClick={handleFinish} className={styles.finishButton}>
                Finish
              </button>
            )}
          </>
        )
      }
    </div >
  );
}

export default QuizDisplay;


