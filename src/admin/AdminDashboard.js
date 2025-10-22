import React, { useState, useCallback } from 'react';
import './admin.css'
import UsersTab from './users/UsersTab';
import ConvosTab from './conversations/ConvosTab';
import SystemMessage from '../components/SystemMessage/SystemMessage';

export default function AdminDashboard({ userData }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'conversations'
  const [systemMessage, setSystemMessage] = useState(null);

  const isAdmin = !!userData?.admin;

  // ---- messaging helpers (shared across tabs) ----
  const clearMessage = useCallback(() => setSystemMessage(null), []);

  const notify = useCallback((message, type = 'info') => {
    setSystemMessage({ message, type });
  }, []);

  // Simple confirm using SystemMessage's action button
  const confirm = useCallback(({ message, onConfirm, actionLabel = 'Confirm' }) => {
    setSystemMessage({
      message,
      type: 'info',
      onClick: async () => {
        try {
          await Promise.resolve(onConfirm?.());
        } finally {
          clearMessage();
        }
      },
      actionLabel,
    });
  }, [clearMessage]);

  // ---- render gate (don’t conditionally call hooks) ----
  if (!isAdmin) {
    return (
      <div className="admin-dashboard-unauthorized">
        <p>Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-root">
      {/* Global banner/dialog for toasts & confirms */}
      {systemMessage && (
        <SystemMessage
          message={systemMessage.message}
          type={systemMessage.type}
          cancelMessage={clearMessage}
          onClick={systemMessage.onClick}
          actionLabel={systemMessage.actionLabel}
        />
      )}

      {/* Header / Tabs */}
      <div className="admin-dashboard-header">
        <div className="admin-tabs">
          <button
            className={activeTab === 'users' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={activeTab === 'conversations' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('conversations')}
          >
            Conversations
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="admin-dashboard-body">
        {activeTab === 'users' ? (
          <UsersTab
            notify={notify}
            confirm={confirm}
            userData={userData}
          />
        ) : (
          <ConvosTab
            notify={notify}
            confirm={confirm}
            userData={userData}
          />
        )}
      </div>
    </div>
  );
}
