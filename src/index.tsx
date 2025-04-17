import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';  // <-- Import the provider
import './css/index.css'; 
import App from './App';
import reportWebVitals from './reportWebVitals';

// Replace with your actual Client ID from Google's OAuth credentials
const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID!;  // ← note the !
type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

const LOG_URL = 'http://localhost:8000/api/front-logs/';

/** Simple throttle: only lets fn run at most once every `wait` ms */
function throttleFn<T extends any[]>(fn: (...args: T) => void, wait: number) {
  let last = 0;
  return (...args: T) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
}

// create a single throttled sender so all levels share the same rate limit
const sendLogToServer = throttleFn(
  (level: LogLevel, logs: string[]) => {
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        logs,
        ts: new Date().toISOString(),
        pathname: window.location.pathname,
      }),
    }).catch((err) => {
      // if sending fails, still print locally
      console.error('[LOGGER‑SHIM] failed to send logs', err);
    });
  },
  5000 // ms
);

function wrapConsoleMethod(level: LogLevel) {
  return (...args: any[]) => {
    // 2) send to server (throttled)
    const serialized = args.map(a =>
      typeof a === 'string' ? a : JSON.stringify(a, null, 2)
    );
    sendLogToServer(level, serialized);
  };
}

// override all the methods you want
console.log   = wrapConsoleMethod('log');
console.info  = wrapConsoleMethod('info');
console.warn  = wrapConsoleMethod('warn');
console.error = wrapConsoleMethod('error');
console.debug = wrapConsoleMethod('debug');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <GoogleOAuthProvider clientId={clientId}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </GoogleOAuthProvider>
);

reportWebVitals();