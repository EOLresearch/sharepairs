import React from 'react';
import './nav.css';
import { IconContext } from "react-icons";
import { FaArrowLeft, FaUserAlt, FaClipboardList } from 'react-icons/fa';
import { IoPeopleCircleOutline } from "react-icons/io5";

const logo = `${process.env.PUBLIC_URL}/sharepairslogo.png`;
const RETURN_LABEL = 'Return to chat';

const NavItem = ({ identifier, icon, label, activeLabel, active, onClick }) => {
  const shown = active && activeLabel ? activeLabel : label;
  const row = (text) => (
    <>
      {icon}
      <span>{text}</span>
    </>
  );
  return (
    <li
      data-identifier={identifier}
      onClick={onClick}
      className={active ? 'is-active' : undefined}
      role="button"
      aria-label={shown}
      aria-pressed={active ? true : undefined}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
    >
      <span className="nav-item-label">
        {activeLabel ? (
          <>
            <span className="nav-label-sizer" aria-hidden="true">{row(label)}</span>
            <span className="nav-label-sizer" aria-hidden="true">{row(activeLabel)}</span>
            <span className="nav-label-live">{row(shown)}</span>
          </>
        ) : (
          <span className="nav-label-live">{row(shown)}</span>
        )}
      </span>
    </li>
  );
};

const Nav = ({
  userData,
  navHandler,
  adminView,
  setAdminView,
  profileView,
  setProfileView,
  assessmentsView,
  setAssessmentsView,
}) => {
  return (
    <IconContext.Provider value={{ className: "react-icons-nav" }}>
      <div className='nav-container' role="navigation" aria-label="Main navigation">
        <img src={logo} alt="Share Pairs logo" />
        <div className='inner-container'>
          <p>Share Pairs</p>
          <p>Peer Support In Survivorship</p>
          <div className={`nav-body ${userData ? "" : "no-user-nav"}`}>
            <ul className="nav-left">
              <NavItem
                identifier="Logout"
                icon={<FaArrowLeft />}
                label="Logout"
                onClick={() => navHandler("Logout")}
              />
              {userData && typeof setProfileView === 'function' && (
                <NavItem
                  identifier="Profile"
                  icon={<FaUserAlt />}
                  label="Profile"
                  activeLabel={RETURN_LABEL}
                  active={profileView}
                  onClick={() => {
                    setAdminView?.(false);
                    setAssessmentsView?.(false);
                    setProfileView((open) => !open);
                  }}
                />
              )}
            </ul>
            <ul className="nav-right">
              {userData && typeof setAssessmentsView === 'function' && (
                <NavItem
                  identifier="Assessments"
                  icon={<FaClipboardList />}
                  label="Assessments"
                  activeLabel={RETURN_LABEL}
                  active={assessmentsView}
                  onClick={() => {
                    setAdminView?.(false);
                    setProfileView?.(false);
                    setAssessmentsView((open) => !open);
                  }}
                />
              )}
              {userData?.admin && typeof adminView !== 'undefined' && typeof setAdminView === 'function' && (
                <NavItem
                  identifier="AdminToggle"
                  icon={<IoPeopleCircleOutline />}
                  label="Admin Dashboard"
                  activeLabel={RETURN_LABEL}
                  active={adminView}
                  onClick={() => {
                    setProfileView?.(false);
                    setAssessmentsView?.(false);
                    setAdminView(!adminView);
                  }}
                />
              )}
            </ul>
          </div>
        </div>
      </div>
    </IconContext.Provider>
  );
};

export default Nav;
