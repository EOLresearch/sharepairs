import React, { useState, useCallback } from 'react';
import './admin.css';
import UsersTab from './users/UsersTab';
import ConvosTab from './conversations/ConvosTab';
import PromptsTab from './prompts/PromptsTab';
import AssessmentsTab from './assessments/AssessmentsTab';
import SystemMessage from '../components/SystemMessage/SystemMessage';

export default function AdminDashboard({ userData }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'conversations' | 'prompts' | 'assessments'
  const [convoUserFilter, setConvoUserFilter] = useState('');
  const [systemMessage, setSystemMessage] = useState(null);

  const isAdmin = !!userData?.admin;

  const clearMessage = useCallback(() => setSystemMessage(null), []);

  const notify = useCallback((message, type = 'info') => {
    setSystemMessage({ message, type });
  }, []);

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

  const viewUserConversations = useCallback((uid) => {
    setConvoUserFilter(uid || '');
    setActiveTab('conversations');
  }, []);

  if (!isAdmin) {
    return (
      <div className="admin-dashboard-unauthorized">
        <p>Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-root">
      {systemMessage && (
        <SystemMessage
          message={systemMessage.message}
          type={systemMessage.type}
          cancelMessage={clearMessage}
          onClick={systemMessage.onClick}
          actionLabel={systemMessage.actionLabel}
        />
      )}

      <div className="admin-dashboard-header">
        <div className="admin-tabs">
          <button
            type="button"
            className={activeTab === 'users' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('users')}
          >
            Participants
          </button>
          <button
            type="button"
            className={activeTab === 'conversations' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('conversations')}
          >
            Conversations
          </button>
          <button
            type="button"
            className={activeTab === 'prompts' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('prompts')}
          >
            Prompts
          </button>
          <button
            type="button"
            className={activeTab === 'assessments' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('assessments')}
          >
            Assessments
          </button>
        </div>
      </div>

      <div className="admin-dashboard-body">
        {activeTab === 'users' && (
          <UsersTab
            notify={notify}
            confirm={confirm}
            userData={userData}
            onViewUserConversations={viewUserConversations}
          />
        )}
        {activeTab === 'conversations' && (
          <ConvosTab
            notify={notify}
            confirm={confirm}
            userData={userData}
            initialSearch={convoUserFilter}
            onInitialSearchConsumed={() => setConvoUserFilter('')}
          />
        )}
        {activeTab === 'prompts' && (
          <PromptsTab notify={notify} confirm={confirm} userData={userData} />
        )}
        {activeTab === 'assessments' && (
          <AssessmentsTab notify={notify} confirm={confirm} userData={userData} />
        )}
      </div>
    </div>
  );
}
