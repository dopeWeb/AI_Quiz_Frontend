// For example, create a file "global.d.ts" in your src folder:
declare global {
    interface Window {
      stopTimer?: () => void;
    }
  }
  export {}; // ensures it's treated as a module
  