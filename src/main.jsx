import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

const searchParams = new URLSearchParams(window.location.search);
const isSidebarReviewMode = searchParams.get('uiReview') === 'sidebar';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSidebarReviewMode ? (
      <App />
    ) : (
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    )}
  </React.StrictMode>,
);
