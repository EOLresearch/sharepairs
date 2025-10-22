import React, { useMemo, lazy, Suspense } from 'react';
import './dashboard.css';
import { IconContext } from 'react-icons';
import { useAuth } from '../UserAuth/AuthContext';

const Chatroom = lazy(() => import('./Chatroom/Chatroom'));
const AdminDashboard = lazy(() => import('../../admin/AdminDashboard'));

function Dashboard({ navHandler, adminView, language, setLanguage }) {
  const { userData } = useAuth();
  const iconContextValue = useMemo(() => ({ className: 'react-icons-dashboard' }), []);
  const showAdmin = !!(userData?.admin && adminView);

  return (
    <IconContext.Provider value={iconContextValue}>
      <div className="dashboard-container">
        <div className="dashboard-body">
          <Suspense fallback={null}>
            {showAdmin ? (
              <AdminDashboard navHandler={navHandler} userData={userData} />
            ) : (
              <Chatroom language={language} setLanguage={setLanguage} />
            )}
          </Suspense>
        </div>
      </div>
    </IconContext.Provider>
  );
}

export default React.memo(Dashboard);
