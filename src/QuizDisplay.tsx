import React, { useState } from "react";
import axios from "axios";
import styles from "./QuizDisplay.module.css";

// Define an interface for an individual quiz question.
interface QuizQuestion {
  question_id: number;
  text: string;
  question_type: "MC" | "TF" | "OE"; // "MC": Multiple Choice, "TF": True/False, "OE": Open Ended
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer: string;
}

// Updated QuizData interface to reflect that questions are objects.
interface QuizData {
  alternatives: never[];
  answers: never[];
  display: {
    questions: string[];      // e.g. ["Question 1", "Question 2", ...]
    alternatives: string[][]; // Array of alternatives for each question
    answers: string[];        // Correct answers (e.g. "a", "true", etc.)
    question_types?: ("MC" | "TF" | "OE")[]; // Optional per-question types for mixed quizzes
  };
  questions: QuizQuestion[];  // Now each question is a QuizQuestion object.
  quizType: "multiple-choice" | "true-false" | "open-ended";
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
  // Allow global quizType to also be "mixed"
  quizType: "multiple-choice" | "true-false" | "open-ended" | "mixed";
  forceReview?: boolean;
}

/**
 * Helper function to get the effective type for a question at a given index.
 * If the global quizType is "mixed", it will use the per‑question type from
 * quizData.display.question_types (if available) or from quizData.questions.
 */
const getEffectiveType = (
  index: number,
  globalQuizType: "multiple-choice" | "true-false" | "open-ended" | "mixed",
  quizData: QuizData
): "multiple-choice" | "true-false" | "open-ended" => {
  if (globalQuizType === "mixed") {
    if (
      quizData.display &&
      quizData.display.question_types &&
      quizData.display.question_types[index]
    ) {
      const qt = quizData.display.question_types[index];
      if (qt === "MC") return "multiple-choice";
      if (qt === "TF") return "true-false";
      if (qt === "OE") return "open-ended";
      return "multiple-choice";
    }
    if (
      quizData.questions &&
      quizData.questions[index] &&
      quizData.questions[index].question_type
    ) {
      const qt = quizData.questions[index].question_type;
      if (qt === "MC") return "multiple-choice";
      if (qt === "TF") return "true-false";
      if (qt === "OE") return "open-ended";
      return "multiple-choice";
    }
    return "multiple-choice";
  }
  return globalQuizType as "multiple-choice" | "true-false" | "open-ended";
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
  if (
    (effectiveType === "multiple-choice" || effectiveType === "open-ended") &&
    alternatives[index] &&
    Array.isArray(alternatives[index]) &&
    alternatives[index].length > 0
  ) {
    return alternatives[index];
  }
  return [];
};

function QuizDisplay({ quizData, quizType }: Props) {
  // Use display data if available; otherwise, fallback to top-level properties.
  let questions: string[] = [];
  let alternatives: string[][] = [];
  let answers: string[] = [];

  if (quizData.display) {
    questions = quizData.display.questions;
    alternatives = quizData.display.alternatives;
    answers = quizData.display.answers;
  } else {
    questions = quizData.questions as unknown as string[]; 
    alternatives = quizData.alternatives || [];
    answers = quizData.answers || [];
  }

  const totalQuestions = questions.length;

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>(
    Array(totalQuestions).fill("")
  );
  const [locked, setLocked] = useState(false);
  const [finalScore, setFinalScore] = useState<string | null>(null);
  const [detailedResults, setDetailedResults] = useState<ScoreDetail[]>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [showAnswer, setShowAnswer] = useState<boolean[]>(
    Array(totalQuestions).fill(false)
  );
  const [openEndedFeedback, setOpenEndedFeedback] = useState<ScoreDetail | null>(
    null
  );

  const currentAlternatives = getCurrentAlternativesForIndex(
    currentIndex,
    quizType,
    quizData,
    alternatives
  );
  console.log("[DEBUG] currentAlternatives for question", currentIndex, ":", currentAlternatives);

  // Handlers
  const handleSelectOption = (val: string) => {
    if (locked) return;
    const updated = [...userAnswers];
    updated[currentIndex] = val;
    setUserAnswers(updated);
  };

  const handleOpenEndedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (locked) return;
    const updated = [...userAnswers];
    updated[currentIndex] = e.target.value;
    setUserAnswers(updated);
  };

  const handleLockAnswer = async () => {
    setLocked(true);

    // 1) Determine the type of the *current question*, not just the whole quiz:
    const effectiveType = getEffectiveType(currentIndex, quizType, quizData);

    // 2) If the current question is open-ended, call your partial scoring
    if (effectiveType === "open-ended") {
      try {
        const payload = {
          user_answers: [userAnswers[currentIndex]],
          correct_answers: [answers[currentIndex]],
          key_concepts: [],
          quiz_type: "open-ended", // pass open-ended for this single question
          questions: [questions[currentIndex]],
          language: "english",
        };
        const response = await axios.post("http://localhost:8000/api/quiz/score", payload);
        // Store partial feedback for this question
        setOpenEndedFeedback(response.data.details[0]);
      } catch (err) {
        console.error("Error evaluating open-ended answer:", err);
        alert("Error evaluating answer. Please try again.");
      }
    }
  };

  const handleNext = () => {
    setLocked(false);
    setCurrentIndex(currentIndex + 1);
    setOpenEndedFeedback(null);
  };

  const handleFinish = async () => {
    try {
      // Normalize answers for each question type
      const normalizedAnswers = userAnswers.map((answer, i) => {
        const effectiveType = getEffectiveType(i, quizType, quizData);
        if (effectiveType === "multiple-choice") {
          if (alternatives[i] && alternatives[i].length > 0) {
            const altIndex = answers[i].toLowerCase().charCodeAt(0) - 97;
            const correctAlternative = alternatives[i][altIndex];
            return correctAlternative?.trim().toLowerCase() === answer.trim().toLowerCase()
              ? answers[i].toLowerCase()
              : answer.toLowerCase();
          }
          return answer.toLowerCase();
        }
        if (effectiveType === "true-false") {
          return answer.trim().toUpperCase();
        }
        // open-ended or default
        return answer.trim().toLowerCase();
      });

      const payload = {
        user_answers: normalizedAnswers,
        correct_answers: answers.map((a) => a.trim().toLowerCase()),
        key_concepts: [],
        quiz_type: quizType,
        questions: questions,
        language: "english",
      };
      const response = await axios.post("http://localhost:8000/api/quiz/score", payload);

      // Inside your handleFinish or wherever you do final scoring:
      let details = response.data.details;

      if (Array.isArray(details)) {
        details = details.map((detail: any) => {
          const qIdx = detail.question_index;
          // get the question's effective type from your local quiz data
          const qType = getEffectiveType(qIdx, quizType, quizData);

          // If open-ended, keep similarity fields:
          if (qType === "open-ended") {
            return detail;
          } else {
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
      setDetailedResults(details);
      setReviewMode(true);
    } catch (err) {
      console.error("Error finishing quiz:", err);
      alert("Error finishing quiz. Please try again.");
    }
  };

  const toggleShowAnswer = (index: number) => {
    const updated = [...showAnswer];
    updated[index] = !updated[index];
    setShowAnswer(updated);
  };

  // REVIEW MODE
  if (reviewMode) {
    console.log("[DEBUG] In REVIEW MODE. finalScore:", finalScore);
    return (
      <div className={styles.container}>
        <h2>{finalScore}</h2>
        <p>Review of all questions:</p>
        {questions.map((qText, i) => {
          const effectiveType = getEffectiveType(i, quizType, quizData);
          const correctAnswer = answers[i] || "";
          const userAnswer = userAnswers[i] || "";

          // Always pull from final results array
          const detail = detailedResults.find((d) => d.question_index === i);

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
            <div key={i} className={styles.questionCard}>
              <h3>
                {i + 1}) {qText}
              </h3>

              {effectiveType === "multiple-choice" ? (
                <>
                  <p>
                    <strong>Your Answer:</strong>{" "}
                    {userLetter >= 0
                      ? String.fromCharCode(65 + userLetter)
                      : userAnswer.toUpperCase() /* CHANGED: fallback to uppercase */}
                  </p>
                  <p>
                    <strong>Correct Answer:</strong>{" "}
                    {correctLetter >= 0
                      ? String.fromCharCode(65 + correctLetter)
                      : correctAnswer.toUpperCase() /* CHANGED: force uppercase */}
                  </p>
                </>
              ) : effectiveType === "true-false" ? (
                <>
                  <p>
                    <strong>Your Answer:</strong>{" "}
                    {capitalizeFirst(userAnswer) /* CHANGED: First letter uppercase */}
                  </p>
                  <p>
                    <strong>Correct Answer:</strong>{" "}
                    {capitalizeFirst(correctAnswer) /* CHANGED */}
                  </p>
                </>
              ) : (
                // open-ended
                <>
                  <p>
                    <strong>Your Answer:</strong> {userAnswer}
                  </p>
                  <p>
                    <strong>Correct Answer:</strong> {correctAnswer}
                  </p>
                  {/* For open-ended, show partial scoring fields if detail exists */}
                  <p>
                    <strong>Text Similarity Percentage:</strong>{" "}
                    {detail ? detail.text_similarity_percentage : 0}%
                  </p>
                  <p>
                    <strong>Semantic Similarity Percentage:</strong>{" "}
                    {detail ? detail.semantic_similarity_percentage : 0}%
                  </p>
                  <p>
                    <strong>Overall Score:</strong> {detail ? detail.overall_score : 0}
                  </p>
                  <p
                    className={
                      detail
                        ? detail.result === "correct"
                          ? styles.correctOption
                          : detail.result === "partially correct"
                            ? styles.partialOption
                            : styles.incorrectOption
                        : ""
                    }
                  >
                    {detail
                      ? detail.result === "correct"
                        ? "Correct!"
                        : detail.result === "partially correct"
                          ? "Partially Correct"
                          : "Incorrect"
                      : ""}
                  </p>
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

  // NORMAL (non-review) RENDER
  const currentQuestion = questions[currentIndex];
  const currentCorrectAnswer = answers[currentIndex];
  const userChoice = userAnswers[currentIndex] || "";
  const effectiveType = getEffectiveType(currentIndex, quizType, quizData);
  const isLastQuestion = currentIndex === totalQuestions - 1;

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
      <div className={styles.questionCard}>
        <h3>
          {currentIndex + 1}) {currentQuestion}
        </h3>

        {(effectiveType === "multiple-choice" && safeCurrentAlternatives.length > 0) ? (
          /* ---------- MULTIPLE-CHOICE RENDER ---------- */
          safeCurrentAlternatives.map((optionText, idx) => {
            // letter = "a","b","c","d"
            const letter = String.fromCharCode(97 + idx);
            // userChoice is "a","b","c","d"
            const isSelected = userChoice.toLowerCase() === letter;

            let appliedStyle = styles.optionBase;
            if (isSelected) {
              appliedStyle += " " + styles.selectedOption;
            }

            // If locked, highlight correct/incorrect
            if (locked) {
              // If letter matches correctAnswer => green
              if (letter === currentCorrectAnswer.toLowerCase()) {
                appliedStyle = styles.optionBase + " " + styles.correctOption;
              }
              // else if user selected => red
              else if (isSelected) {
                appliedStyle = styles.optionBase + " " + styles.incorrectOption;
              }
            }

            return (
              <div
                key={letter}
                className={appliedStyle}
                onClick={() => handleSelectOption(letter)} // store letter in userAnswers
              >
                <div className={styles.letterBox}>{letter.toUpperCase()}</div>
                <div>{optionText}</div>
              </div>
            );
          })
          
        ) : (effectiveType === "true-false" && safeCurrentAlternatives.length > 0) ? (
          /* ---------- TRUE-FALSE RENDER ---------- */
          safeCurrentAlternatives.map((optionText, idx) => {
            // idx=0 => "True", idx=1 => "False"
            const tfValue = idx === 0 ? "True" : "False";
            // userChoice is "True"/"False"
            const isSelected = userChoice === tfValue;

            let appliedStyle = styles.optionBase;
            if (isSelected) {
              appliedStyle += " " + styles.selectedOption;
            }

            // If locked, highlight correct/incorrect
            if (locked) {
              if (tfValue.toLowerCase() === currentCorrectAnswer.toLowerCase()) {
                appliedStyle = styles.optionBase + " " + styles.correctOption;
              } else if (isSelected) {
                appliedStyle = styles.optionBase + " " + styles.incorrectOption;
              }
            }

            return (
              <div
                key={tfValue}
                className={appliedStyle}
                onClick={() => handleSelectOption(tfValue)} // store "True"/"False"
              >
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
            {getCurrentAlternativesForIndex(
              currentIndex,
              quizType,
              quizData,
              alternatives
            ).length > 0 ? (
              /* If open-ended has alternatives, display them similarly */
              getCurrentAlternativesForIndex(
                currentIndex,
                quizType,
                quizData,
                alternatives
              ).map((optionText, idx) => {
                const letter = String.fromCharCode(97 + idx);
                const isSelected =
                  userChoice.toLowerCase() === letter ||
                  userChoice.trim().toLowerCase() ===
                  (optionText || "").trim().toLowerCase();
                let appliedStyle = `${styles.optionBase}`;
                if (isSelected) {
                  appliedStyle = `${styles.optionBase} ${styles.selectedOption}`;
                }
                if (locked) {
                  if (
                    letter === currentCorrectAnswer.toLowerCase() ||
                    (optionText || "").trim().toLowerCase() ===
                    currentCorrectAnswer.trim().toLowerCase()
                  ) {
                    appliedStyle = `${styles.optionBase} ${styles.correctOption}`;
                  } else if (isSelected) {
                    appliedStyle = `${styles.optionBase} ${styles.incorrectOption}`;
                  }
                }
                return (
                  <div
                    key={letter}
                    className={appliedStyle}
                    onClick={() => handleSelectOption(optionText)}
                  >
                    <div className={styles.letterBox}>{letter.toUpperCase()}</div>
                    <div>{optionText}</div>
                  </div>
                );
              })
            ) : (
              /* Otherwise, standard text area + partial feedback */
              <div className={styles.openEndedContainer}>
                <textarea
                  placeholder="Enter your answer"
                  value={userChoice}
                  onChange={handleOpenEndedChange}
                  className={styles.textareaBox}
                />

                {/* Show/hide the correct answer if user toggles it */}
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

                {/* Once locked, show partial feedback (Correct/Partially/Incorrect) */}
                {locked && openEndedFeedback && (
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
            )}
          </>
        )}
      </div>

      {/* Footer Buttons */}
      {!locked ? (
        <button
          onClick={handleLockAnswer}
          disabled={!userAnswers[currentIndex]}
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
      )}
    </div>
  );
}

export default QuizDisplay;
