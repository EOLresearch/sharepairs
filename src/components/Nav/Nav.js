import React from 'react';
import './nav.css';
import { IconContext } from "react-icons";
import { FaArrowLeft } from 'react-icons/fa';
import { IoPeopleCircleOutline, IoChatbubblesSharp } from "react-icons/io5";
import { RiUserSettingsLine } from "react-icons/ri";
import logo from '../../assets/sharepairslogo.png';
import LanguageToggle from '../LanguageToggle/LanguageToggle';

const NavItem = ({ identifier, icon, label, onClick, style }) => (
  <li
    data-identifier={identifier}
    onClick={onClick}
    className={style}
    role="button"
    aria-label={`Navigate to ${label}`}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
  >
    {icon}
    <span>{label}</span>
  </li>
);

const Nav = ({ userData, navHandler, adminView, setAdminView, language, setLanguage }) => {
  return (
    <IconContext.Provider value={{ className: "react-icons-nav" }}>
      <div className='nav-container' role="navigation" aria-label="Main navigation">
        <img src={logo} alt="Share Pairs logo" />
        <div className='inner-container'>
          <p>Share Pairs</p>
          <p>Peer Support In Survivorship</p>
          <div className='language-toggle-container'>
            <LanguageToggle language={language} setLanguage={setLanguage} />
          </div>
          <div className={`nav-body ${userData ? "" : "no-user-nav"}`}>
            <ul>
              <NavItem
                identifier="Logout"
                icon={<FaArrowLeft />}
                label={language === 'tr' ? "Çıkış Yap" : "Logout"}
                onClick={() => navHandler("Logout")}
              />
              {/* <NavItem
                identifier="Account"
                icon={<RiUserSettingsLine />}
                label="Account options"
                onClick={() => {console.log("Account options clicked");}}
              /> */}
              {userData?.admin && typeof adminView !== 'undefined' && typeof setAdminView === 'function' && (
                <NavItem
                  identifier="AdminToggle"
                  icon={adminView ? <IoChatbubblesSharp /> : <IoPeopleCircleOutline />}
                  label={adminView ? "Switch to Chat" : "Admin Dashboard"}
                  onClick={() => setAdminView(!adminView)}
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
