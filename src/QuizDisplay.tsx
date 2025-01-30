import React, { useState } from "react";
import axios from "axios";
import styles from './QuizDisplay.module.css';

interface QuizData {
  questions: string[];
  alternatives?: string[][];
  answers: string[];
}

interface Props {
  quizData: QuizData;
  quizType: "multiple-choice" | "true-false" | "open-ended";
}

function QuizDisplay({ quizData, quizType }: Props) {
  const { questions, answers } = quizData;
  const alternatives = quizData.alternatives || []; // For multiple-choice/TF
  const totalQuestions = questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>(Array(totalQuestions).fill(""));
  const [locked, setLocked] = useState(false);
  const [finalScore, setFinalScore] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [showAnswer, setShowAnswer] = useState<boolean[]>(Array(totalQuestions).fill(false));

  const toggleShowAnswer = (index: number) => {
    const updated = [...showAnswer];
    updated[index] = !updated[index];
    setShowAnswer(updated);
  };

  if (reviewMode) {
    return (
      <div className={styles.container}>
        <h2>{finalScore}</h2>
        <p>Review of all questions:</p>

        {questions.map((qText, i) => {
          const correctAnswer = answers[i];
          const userAnswer = userAnswers[i] || "";
          const theseAlternatives =
            quizType === "true-false" ? ["True", "False"] : alternatives[i] || [];

          return (
            <div key={i} className={styles.questionCard}>
              <h3>{i + 1}) {qText}</h3>

              {(quizType === "multiple-choice" || quizType === "true-false") && theseAlternatives.length > 0 && (
                theseAlternatives.map((optionText, idx) => {
                  const letter = String.fromCharCode(97 + idx);
                  let appliedStyle = `${styles.optionBase} ${styles.defaultOption}`;

                  if (
                    letter === correctAnswer ||
                    optionText.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
                  ) {
                    appliedStyle = `${styles.optionBase} ${styles.correctOption}`;
                  } else if (
                    (userAnswer === letter && letter !== correctAnswer) ||
                    (userAnswer === optionText && optionText !== correctAnswer)
                  ) {
                    appliedStyle = `${styles.optionBase} ${styles.incorrectOption}`;
                  }

                  return (
                    <div key={letter} className={appliedStyle}>
                      <div className={styles.letterBox}>{letter.toUpperCase()}</div>
                      <div>{optionText}</div>
                    </div>
                  );
                })
              )}

              {quizType === "open-ended" && (
                <div>
                  <p><strong>Your Answer:</strong> {userAnswer}</p>
                  {userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase() ? (
                    <p className={styles.correctOption}>Correct!</p>
                  ) : (
                    <p className={styles.incorrectOption}>
                      Wrong. Correct answer is <strong>{correctAnswer}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const correctAnswer = answers[currentIndex];
  const userChoice = userAnswers[currentIndex] || "";
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const currentAlternatives =
    quizType === "multiple-choice"
      ? alternatives[currentIndex] || []
      : ["True", "False"];

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

  const handleLockAnswer = () => {
    setLocked(true);
  };

  const handleNext = () => {
    setLocked(false);
    setCurrentIndex(currentIndex + 1);
  };

  const handleFinish = async () => {
    try {
      const normalizedAnswers = userAnswers.map((answer, index) => {
        if (quizType === "multiple-choice") {
          const correctAlternative = alternatives[index]?.[answers[index].charCodeAt(0) - 97];
          return correctAlternative?.trim().toLowerCase() === answer.trim().toLowerCase()
            ? answers[index]
            : answer;
        }
        return answer.trim().toLowerCase();
      });

      const response = await axios.post("http://localhost:8000/api/quiz/score", {
        user_answers: normalizedAnswers,
        correct_answers: answers.map((a) => a.trim().toLowerCase()),
      });

      setFinalScore(`Your score is ${response.data.score}/${response.data.total}`);
      setReviewMode(true);
    } catch (err) {
      alert("Error finishing quiz");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.questionCard}>
        <h3>
          {currentIndex + 1}) {currentQuestion}
        </h3>

        {(quizType === "multiple-choice" || quizType === "true-false") && currentAlternatives.length > 0 && (
          currentAlternatives.map((optionText, idx) => {
            const letter = String.fromCharCode(97 + idx);
            const isSelected = userChoice === letter || userChoice === optionText;
            let appliedStyle = `${styles.optionBase}`;

            if (isSelected) {
              appliedStyle = `${styles.optionBase} ${styles.selectedOption}`;
            }
            if (locked) {
              if (letter === correctAnswer || optionText.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) {
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
        )}

        {quizType === "open-ended" && (
          <div>
            <input
              type="text"
              placeholder="Type your answer here"
              value={userChoice}
              onChange={handleOpenEndedChange}
              className={styles.inputBox}
            />

            <button
              onClick={() => toggleShowAnswer(currentIndex)}
              className={styles.toggleButton}
            >
              {showAnswer[currentIndex] ? "Hide Answer" : "Show Answer"}
            </button>

            {showAnswer[currentIndex] && (
              <p className={styles.answerBox}>
                <strong>Correct Answer:</strong> {correctAnswer}
              </p>
            )}

            {locked && (
              userChoice.trim().toLowerCase() === correctAnswer.trim().toLowerCase() ? (
                <p className={styles.correctOption}>Correct!</p>
              ) : (
                <p className={styles.incorrectOption}>
                  Wrong. Correct answer is <strong>{correctAnswer}</strong>
                </p>
              )
            )}
          </div>
        )}
      </div>

      {!locked ? (
        <button
          onClick={handleLockAnswer}
          disabled={!userChoice}
          className={styles.lockButton}
        >
          Lock Answer
        </button>
      ) : (
        <>
          {!isLastQuestion && (
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
