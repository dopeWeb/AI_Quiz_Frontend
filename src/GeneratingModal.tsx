import React from "react";
import styles from "./GeneratingModal.module.css";

interface GeneratingModalProps {
  show: boolean;
}

const GeneratingModal: React.FC<GeneratingModalProps> = ({ show }) => {
  if (!show) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Generating</h2>
        <div className={styles.spinner}></div>
        <p>Your quiz is being created.</p>
      </div>
    </div>
  );
};

export default GeneratingModal;
