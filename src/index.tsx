import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';  // <-- Import the provider
import './index.css';
import App from './App.tsx';
import reportWebVitals from './reportWebVitals.ts';

// Replace with your actual Client ID from Google's OAuth credentials
const GOOGLE_CLIENT_ID = "272126494148-j3m4pinc17llgadd5l4gk7ve80cshif3.apps.googleusercontent.com";

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    {/* Wrap entire app with GoogleOAuthProvider */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} children={undefined}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

reportWebVitals();
