import React, { useState, useCallback } from 'react';
import Nav from './components/Nav/Nav';
import { useAuth } from './components/UserAuth/AuthContext';

const AppLayout = ({ children, language, setLanguage }) => {
  const [adminView, setAdminView] = useState(false);

  const { userData, logout, resetAuthContext } = useAuth();

const navHandler = useCallback(async (action) => {
  if (action === 'Logout') {
    try {
      await logout();
      resetAuthContext();   // 🧼 Wipe auth context
      setAdminView(false);  // 🧼 Reset local state
      console.log("✅ Logged out and state cleared");
    } catch (err) {
      console.error("❌ Logout failed:", err.message);
    }
  }
}, [logout, resetAuthContext, setAdminView]);

  return (
    <div className="App">
      <div className="app-container">
        <Nav
          navHandler={navHandler}
          userData={userData}
          adminView={adminView}
          setAdminView={setAdminView}
          language={language}
          setLanguage={setLanguage}
        />
        <div className="app-inner-container">
          <div className="app-body">
            {React.isValidElement(children)
              ? React.cloneElement(children, {
                adminView,
                setAdminView,
                language,
                setLanguage
              })
              : children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
