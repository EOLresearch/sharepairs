import React from 'react';
import Nav from './components/Nav/Nav';
import { useAuth } from './components/UserAuth/AuthContext';

const AppLayout = ({ children }) => {
  const [adminView, setAdminView] = React.useState(false);
  const [profileView, setProfileView] = React.useState(false);
  const [assessmentsView, setAssessmentsView] = React.useState(false);

  const { userData, logout, resetAuthContext } = useAuth();

  const navHandler = React.useCallback(async (action) => {
    if (action === 'Logout') {
      try {
        await logout();
        resetAuthContext();
        setAdminView(false);
        setProfileView(false);
        setAssessmentsView(false);
        console.log('Logged out and state cleared');
      } catch (err) {
        console.error('Logout failed:', err.message);
      }
    }
  }, [logout, resetAuthContext]);

  return (
    <div className="App">
      <div className="app-container">
        <Nav
          navHandler={navHandler}
          userData={userData}
          adminView={adminView}
          setAdminView={setAdminView}
          profileView={profileView}
          setProfileView={setProfileView}
          assessmentsView={assessmentsView}
          setAssessmentsView={setAssessmentsView}
        />
        <div className="app-inner-container">
          <div className="app-body">
            {React.isValidElement(children)
              ? React.cloneElement(children, {
                adminView,
                setAdminView,
                profileView,
                setProfileView,
                assessmentsView,
                setAssessmentsView,
              })
              : children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
