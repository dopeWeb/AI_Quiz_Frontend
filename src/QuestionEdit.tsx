import React, { useState, useEffect } from "react";
import "./EditQuiz.css";
import axios from "axios";

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

type QuestionType = "MC" | "TF" | "OE";

interface Question {
  question_id: number;
  question_type: QuestionType;
  text: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer?: string;
}

interface Props {
  question: Question;
  onSave: (updated: Question) => void;
  onDelete?: (id: number) => void;
  ordinal: number; // e.g. "Question 1"
}

const QuestionEdit: React.FC<Props> = ({ question, onDelete, onSave, ordinal }) => {
  // The main question type
  const [qType, setQType] = useState<QuestionType>(question.question_type);

  // Basic fields
  const [qText, setQText] = useState(question.text);
  const [optionA, setOptionA] = useState(question.option_a || "");
  const [optionB, setOptionB] = useState(question.option_b || "");
  const [optionC, setOptionC] = useState(question.option_c || "");
  const [optionD, setOptionD] = useState(question.option_d || "");

  // Separate states for MC vs. TF vs. OE answers
  const [mcCorrectAnswer, setMcCorrectAnswer] = useState<string>("");  // "A", "B", "C", or "D"
  const [tfCorrectAnswer, setTfCorrectAnswer] = useState<string>("True"); // "True" or "False"
  const [oeCorrectAnswer, setOeCorrectAnswer] = useState<string>("");  // any text

  // On mount, populate whichever local state is relevant
  useEffect(() => {
    if (question.question_type === "MC") {
      setMcCorrectAnswer((question.correct_answer || "").toUpperCase()); // e.g. "B"
    } else if (question.question_type === "TF") {
      setTfCorrectAnswer(question.correct_answer === "False" ? "False" : "True");
    } else {
      // OE
      setOeCorrectAnswer(question.correct_answer || "");
    }
  }, [question]);

  // If user changes question type, do not wipe out the old MC or TF states, 
  // but set a default if we pick TF and it has nothing, or OE, etc.
  const handleTypeChange = (newType: QuestionType) => {
    setQType(newType);
    if (newType === "TF") {
      if (tfCorrectAnswer !== "True" && tfCorrectAnswer !== "False") {
        setTfCorrectAnswer("True");
      }
    }
    else if (newType === "MC") {
      // If we haven't stored a valid letter, default to "A"
      const validLetters = ["A", "B", "C", "D"];
      if (!validLetters.includes(mcCorrectAnswer.toUpperCase())) {
        setMcCorrectAnswer("A");
      }
    }
    else {
      // newType is "OE"
      // If you want to automatically set MC to "A" whenever you switch away from MC:
      // we can do it here or inside handleSave. 
      // This sets it so the next time we switch back to MC, it shows A.
      const validLetters = ["A", "B", "C", "D"];
      if (!validLetters.includes(mcCorrectAnswer.toUpperCase())) {
        setMcCorrectAnswer("A");
      }
    }
  };

  // On Save, pick whichever local state is relevant for final "correct_answer"
  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    let finalCorrect = "";
    if (qType === "MC") {
      finalCorrect = mcCorrectAnswer.toUpperCase();  // "A", "B", "C", or "D"
    } else if (qType === "TF") {
      finalCorrect = tfCorrectAnswer;  // "True" or "False"
      // Also, since user wants "MC" to be forced to 'A' whenever we are TF or OE:
      setMcCorrectAnswer("A");
    } else {
      // OE
      finalCorrect = oeCorrectAnswer;
      // Also, set MC to "A"
      setMcCorrectAnswer("A");
    }

    // Build the updated question object
    const updated: Question = {
      ...question,
      question_type: qType,
      text: qText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_answer: finalCorrect,
    };

    // If your backend also needs tf_option_true / tf_option_false
    if (qType === "TF") {
      (updated as any).tf_option_true = "True";
      (updated as any).tf_option_false = "False";
    }

    console.log("Updated object to submit:", updated);

    // Send to backend
    const csrftoken = getCookie("csrftoken");
    try {
      const response = await axios.put(
        `http://localhost:8000/api/questions/${question.question_id}/update/`,
        updated,
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrftoken || "" },
        }
      );
      console.log("Question updated successfully:", response.data);

      // Let the parent know
      onSave(updated);

      alert("Question updated successfully.");
    } catch (error) {
      console.error("Error updating question:", error);
      alert("Error saving changes. Please try again.");
    }
  };

  const handleDelete = async () => {
    console.log("handleDelete called for question:", question.question_id);
    try {
      const csrftoken = getCookie("csrftoken");
      console.log("Sending PATCH request to soft-delete question:", question.question_id);

      await axios.patch(
        `http://localhost:8000/api/questions/${question.question_id}/softdelete/`,
        {},
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrftoken || "" },
        }
      );
      console.log("Soft-delete successful for question:", question.question_id);

      if (onDelete) {
        onDelete(question.question_id);
      }
    } catch (err) {
      console.error("Error soft-deleting question:", err);
      alert("Error deleting question. Please try again.");
    }
  };

  return (
    <div className="question-edit-card">
      <div className="question-edit-header">
        <h3>Question {ordinal}</h3>
        <div>
          <button className="question-edit-delete-btn" onClick={handleDelete}>
            <span role="img" aria-label="trash">
              🗑
            </span>
          </button>
        </div>
      </div>

      {/* QUESTION TYPE SELECT */}
      <div className="question-edit-type-row">
        <div className="question-type-col">
          <label>Question Type</label>
          <select value={qType} onChange={(e) => handleTypeChange(e.target.value as QuestionType)}>
            <option value="MC">Multiple Choice</option>
            <option value="OE">Open Ended</option>
            <option value="TF">True/False</option>
          </select>
        </div>
      </div>

      {/* QUESTION TEXT */}
      <div className="question-edit-field">
        <label>Question</label>
        <textarea
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="Enter the question..."
          maxLength={500}  // Limit to 500 characters
        />
      </div>

      {/* MULTIPLE CHOICE */}
      {qType === "MC" && (
        <div className="question-edit-mc-options">
          <label className="mc-options-title">Options</label>

          {/* Option A */}
          <div className="mc-option-row">
            <input
              type="radio"
              name={`mc-correct-${question.question_id}`}
              value="A"
              checked={mcCorrectAnswer.toUpperCase() === "A"}
              onChange={() => setMcCorrectAnswer("A")}
            />
            <input
              type="text"
              placeholder="Option A..."
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              maxLength={150}  // Limit to 150 characters per option
            />
          </div>

          {/* Option B */}
          <div className="mc-option-row">
            <input
              type="radio"
              name={`mc-correct-${question.question_id}`}
              value="B"
              checked={mcCorrectAnswer.toUpperCase() === "B"}
              onChange={() => setMcCorrectAnswer("B")}
            />
            <input
              type="text"
              placeholder="Option B..."
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              maxLength={150}
            />
          </div>

          {/* Option C */}
          <div className="mc-option-row">
            <input
              type="radio"
              name={`mc-correct-${question.question_id}`}
              value="C"
              checked={mcCorrectAnswer.toUpperCase() === "C"}
              onChange={() => setMcCorrectAnswer("C")}
            />
            <input
              type="text"
              placeholder="Option C..."
              value={optionC}
              onChange={(e) => setOptionC(e.target.value)}
              maxLength={150}
            />
          </div>

          {/* Option D */}
          <div className="mc-option-row">
            <input
              type="radio"
              name={`mc-correct-${question.question_id}`}
              value="D"
              checked={mcCorrectAnswer.toUpperCase() === "D"}
              onChange={() => setMcCorrectAnswer("D")}
            />
            <input
              type="text"
              placeholder="Option D..."
              value={optionD}
              onChange={(e) => setOptionD(e.target.value)}
              maxLength={150}
            />
          </div>
        </div>
      )}

      {/* OPEN-ENDED */}
      {qType === "OE" && (
        <div className="question-edit-field">
          <label>Answer</label>
          <textarea
            value={oeCorrectAnswer}
            onChange={(e) => setOeCorrectAnswer(e.target.value)}
            placeholder="Open-ended answer..."
            maxLength={500}  // Limit to 500 characters
          />
          <p className="answer-subtext">
            When taking this quiz, your response will be evaluated based on both semantic_similarity_percentage and text_similarity_percentage to determine an overall score.
            This approach prioritizes your intended meaning rather than exact wording.
          </p>
        </div>
      )}


      {/* TRUE / FALSE */}
      {qType === "TF" && (
        <div className="question-edit-field">
          <label>Correct Answer</label>
          <div className="tf-option" style={{ marginBottom: "1rem" }}>
            <input
              type="radio"
              name={`tf-${question.question_id}`}
              checked={tfCorrectAnswer === "True"}
              onChange={() => setTfCorrectAnswer("True")}
            />
            <span style={{ fontSize: "1rem", marginRight: "2rem" }}>True</span>

            <input
              type="radio"
              name={`tf-${question.question_id}`}
              checked={tfCorrectAnswer === "False"}
              onChange={() => setTfCorrectAnswer("False")}
            />
            <span style={{ fontSize: "1rem", marginLeft: "0.5rem" }}>False</span>
          </div>
        </div>
      )}

      <div className="question-edit-bottom-row">
        <button className="question-save-btn" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default QuestionEdit;
