import React, { useState, useEffect } from "react";
import "./EditQuiz.css";
import axios from "axios";
import { Draggable } from "@hello-pangea/dnd"; // Import Draggable
import { toast,  } from "react-toastify";


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
  onChange?: (updated: Question) => void;

}

const QuestionEdit: React.FC<Props> = ({ question, onDelete, onSave, ordinal, onChange }) => {
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
  const [savedMCAnswer, setSavedMCAnswer] = useState<string>("");

  // On mount, populate whichever local state is relevant
   // Initialize states based on the question prop.
   useEffect(() => {
    if (question.question_type === "MC") {
      const initialMC = (question.correct_answer || "").toUpperCase();
      setMcCorrectAnswer(initialMC);
      setSavedMCAnswer(initialMC);
    } else if (question.question_type === "TF") {
      setTfCorrectAnswer(question.correct_answer === "False" ? "False" : "True");
    } else {
      setOeCorrectAnswer(question.correct_answer || "");
    }
  }, [question]);

  const handleTypeChange = (newType: QuestionType) => {
    // Create a temporary variable for the MC answer.
    let newMC = mcCorrectAnswer;
  
    // If switching away from MC, save the current MC answer.
    if (qType === "MC" && newType !== "MC") {
      setSavedMCAnswer(mcCorrectAnswer);
    }
  
    if (newType === "TF") {
      // For True/False, ensure a default is set.
      if (tfCorrectAnswer !== "True" && tfCorrectAnswer !== "False") {
        setTfCorrectAnswer("True");
      }
      // (Do not update MC here because we want to preserve it if already valid.)
    } else if (newType === "MC") {
      // When switching to MC, restore the saved MC answer if valid; otherwise default to "A"
      newMC = (savedMCAnswer && ["A", "B", "C", "D"].includes(savedMCAnswer))
        ? savedMCAnswer
        : "A";
      // Force update mcCorrectAnswer with newMC immediately.
      setMcCorrectAnswer(newMC);
    } else {
      // For open-ended, we don't update the MC answer.
    }
  
    // Update the question type
    setQType(newType);
  
    // Build the updated question object using the computed newMC value
    const updated: Question = {
      ...question,
      question_type: newType,
      text: qText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_answer:
        newType === "MC"
          ? newMC.toUpperCase()  // Use our temporary newMC value here.
          : newType === "TF"
          ? tfCorrectAnswer
          : oeCorrectAnswer,
    };
  
    if (newType === "TF") {
      (updated as any).tf_option_true = "True";
      (updated as any).tf_option_false = "False";
    }
  
    console.log("[DEBUG] Auto-saving on type change with updated object:", updated);
    onSave(updated);
  };
  
  


  // On Save, pick whichever local state is relevant for final "correct_answer"
  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  
    let finalCorrect = "";
    if (qType === "MC") {
      // Use "A" if mcCorrectAnswer is empty after trimming; otherwise, use the saved value.
      finalCorrect = mcCorrectAnswer.trim() === "" ? "A" : mcCorrectAnswer.toUpperCase();
    } else if (qType === "TF") {
      finalCorrect = tfCorrectAnswer;  // "True" or "False"
      setMcCorrectAnswer("A");  // (optional) You may keep this if you want to reset MC when switching to TF
    } else {
      // For open-ended, just use the open-ended answer. Do not override MC.
      finalCorrect = oeCorrectAnswer;
      // (Remove the forced setMcCorrectAnswer("A"))
    }
  
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
  
    if (qType === "TF") {
      (updated as any).tf_option_true = "True";
      (updated as any).tf_option_false = "False";
    }
  
    console.log("Updated object to submit:", updated);
  
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
      onSave(updated);
      toast.success("Question updated successfully.", { containerId: "local" });
    } catch (error) {
      console.error("Error updating question:", error);
      toast.error("Error saving changes. Please try again.");
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
      toast.error("Error deleting question. Please try again.");
    }
  };


 
  return (
    <Draggable draggableId={question.question_id.toString()} index={ordinal - 1}>
      {(provided) => (
        <div
          className="question-edit-card"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
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
              onChange={(e) => {
                setQText(e.target.value);
                onChange && onChange({ ...question, text: e.target.value });
              }}
              placeholder="Enter the question..."
              maxLength={200}
            />
          </div>

          {/* MULTIPLE CHOICE */}
          {qType === "MC" && (
            <div className="question-edit-mc-options">
              <label className="mc-options-title">Options</label>
              {["A", "B", "C", "D"].map((letter) => {
                // Determine current option text.
                let optionText = "";
                if (letter === "A") optionText = optionA;
                else if (letter === "B") optionText = optionB;
                else if (letter === "C") optionText = optionC;
                else if (letter === "D") optionText = optionD;

                const isSelected = mcCorrectAnswer.toUpperCase() === letter;

                // Function to build updated question and call onSave.
                const triggerSave = (updatedFields: Partial<Question>) => {
                  const updated: Question = {
                    ...question,
                    question_type: qType,
                    text: qText,
                    option_a: optionA,
                    option_b: optionB,
                    option_c: optionC,
                    option_d: optionD,
                    // Use the updated correct answer if provided, else current.
                    correct_answer: updatedFields.correct_answer || mcCorrectAnswer,
                    ...updatedFields,
                  };
                  onSave(updated);
                };

                return (
                  <div key={letter} className="mc-option-row">
                    <label>
                      <input
                        type="radio"
                        name={`mc-correct-${question.question_id}`}
                        value={letter}
                        checked={isSelected}
                        onChange={(e) => {
                          setMcCorrectAnswer(e.target.value);
                          // Do not trigger save immediately on radio change.
                        }}
                        onBlur={() => {
                          // When leaving the radio, trigger save with current correct answer.
                          triggerSave({ correct_answer: mcCorrectAnswer });
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      placeholder={`Option ${letter}...`}
                      value={optionText}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (letter === "A") setOptionA(newValue);
                        else if (letter === "B") setOptionB(newValue);
                        else if (letter === "C") setOptionC(newValue);
                        else if (letter === "D") setOptionD(newValue);
                      }}
                      onBlur={(e) => {
                    
                        if (letter === "A") {
                          triggerSave({ option_a: e.target.value });
                        } else if (letter === "B") {
                          triggerSave({ option_b: e.target.value });
                        } else if (letter === "C") {
                          triggerSave({ option_c: e.target.value });
                        } else if (letter === "D") {
                          triggerSave({ option_d: e.target.value });
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}





          {/* OPEN-ENDED */}
          {qType === "OE" && (
            <div className="question-edit-field">
              <label>Answer</label>
              {(() => {
                // Define an autoSave function that builds an updated question object.
                const autoSave = (newAnswer: string) => {
                  const updated: Question = {
                    ...question,
                    question_type: qType,
                    text: qText,
                    // For open-ended questions, the "correct_answer" field holds the answer.
                    correct_answer: newAnswer,
                  };
                  // Call the parent's onSave callback to update the quiz state.
                  onSave(updated);
                };

                return (
                  <textarea
                    value={oeCorrectAnswer}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setOeCorrectAnswer(newVal);
                      autoSave(newVal);
                    }}
                    placeholder="Open-ended answer..."
                    maxLength={600}  // Limit to 500 characters
                  />
                );
              })()}
              <p className="answer-subtext">
                When taking this quiz, your response will be evaluated based on both semantic similarity and text similarity percentages to determine an overall score.
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
                  onChange={() => {
                    // Update the local state.
                    setTfCorrectAnswer("True");
                    // Build the updated question object.
                    const updated: Question = {
                      ...question,
                      question_type: qType,
                      text: qText,
                      correct_answer: "True",
                    };
                    // For TF questions, include additional fields if needed.
                    (updated as any).tf_option_true = "True";
                    (updated as any).tf_option_false = "False";
                    // Call the parent's onSave callback.
                    onSave(updated);
                  }}
                />
                <span style={{ fontSize: "1rem", marginRight: "2rem" }}>True</span>
                <input
                  type="radio"
                  name={`tf-${question.question_id}`}
                  checked={tfCorrectAnswer === "False"}
                  onChange={() => {
                    setTfCorrectAnswer("False");
                    const updated: Question = {
                      ...question,
                      question_type: qType,
                      text: qText,
                      correct_answer: "False",
                    };
                    (updated as any).tf_option_true = "True";
                    (updated as any).tf_option_false = "False";
                    onSave(updated);
                  }}
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
      )}
    </Draggable>
  );
};

export default QuestionEdit;
