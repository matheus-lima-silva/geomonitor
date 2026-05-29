import React from 'react';
import ReactDOM from 'react-dom/client';
import '@app/styles.css';
import RelatApp from './RelatApp';
import { AuthProvider } from '@app/context/AuthContext';
import { ToastProvider } from '@app/context/ToastContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RelatApp />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
);
