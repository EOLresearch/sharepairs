import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import './dashboard.css';
import { IconContext } from 'react-icons';
import { useAuth } from '../UserAuth/AuthContext';
import { updateUserProfile } from '../../services/authService';
import { on, off } from '../../realtime/client';
import MatchNotice from './Chatroom/MatchNotice';

const Chatroom = lazy(() => import('./Chatroom/Chatroom'));
const AdminDashboard = lazy(() => import('../../admin/AdminDashboard'));
const ProfilePage = lazy(() => import('./Profile/ProfilePage'));
const AssessmentsPage = lazy(() => import('./Assessments/AssessmentsPage'));

function Dashboard({
  navHandler,
  adminView,
  profileView,
  assessmentsView,
  setAdminView,
  setProfileView,
  setAssessmentsView,
}) {
  const { userData, refreshAuth } = useAuth();
  const iconContextValue = useMemo(() => ({ className: 'react-icons-dashboard' }), []);
  const showAdmin = !!(userData?.admin && adminView);
  const [offerStartConvo, setOfferStartConvo] = useState(false);
  const [acceptedInvite, setAcceptedInvite] = useState(null);

  useEffect(() => {
    const handler = (payload) => {
      const convo = payload?.conversation;
      const id = convo?.docID || convo?.cid;
      if (!id) return;
      setAdminView?.(false);
      setProfileView?.(false);
      setAssessmentsView?.(false);
      setAcceptedInvite({
        id,
        conversation: { ...convo, docID: id, mutualConsent: true },
        name: payload?.acceptedBy?.displayName || 'your match',
        otherUid: payload?.acceptedBy?.uid || null,
      });
    };
    on('conversationAccepted', handler);
    return () => off('conversationAccepted', handler);
  }, [setAdminView, setProfileView, setAssessmentsView]);
  const showMatchNotice =
    !!userData &&
    !userData.isSupport &&
    Boolean(userData.simpaticoMatch) &&
    userData.matchNoticeSeen !== true;

  const dismissMatchNotice = async () => {
    const id = userData?.authId || userData?.uid;
    if (!id) return;
    await updateUserProfile(id, { matchNoticeSeen: true });
    await refreshAuth?.();
    setAdminView?.(false);
    setProfileView?.(false);
    setAssessmentsView?.(false);
    setOfferStartConvo(true);
  };

  return (
    <IconContext.Provider value={iconContextValue}>
      <div className="dashboard-container">
        <div className="dashboard-body">
          <Suspense fallback={null}>
            {showAdmin ? (
              <AdminDashboard navHandler={navHandler} userData={userData} />
            ) : profileView ? (
              <ProfilePage />
            ) : assessmentsView ? (
              <AssessmentsPage />
            ) : (
              <Chatroom
                startConvoPrompt={offerStartConvo}
                onStartConvoPromptHandled={() => setOfferStartConvo(false)}
                acceptedInvite={acceptedInvite}
                onAcceptedInviteHandled={() => setAcceptedInvite(null)}
              />
            )}
          </Suspense>
        </div>
      </div>
      {showMatchNotice && createPortal(
        <div className="welcome-message-overlay match-notice-overlay">
          <MatchNotice userData={userData} onDismiss={dismissMatchNotice} />
        </div>,
        document.body
      )}
    </IconContext.Provider>
  );
}

export default React.memo(Dashboard);
