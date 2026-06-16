import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './components/UserAuth/AuthContext';
import { ConnectionProvider } from './connection';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ConnectionProvider>
        <App />
      </ConnectionProvider>
    </AuthProvider>
  </React.StrictMode>
);

