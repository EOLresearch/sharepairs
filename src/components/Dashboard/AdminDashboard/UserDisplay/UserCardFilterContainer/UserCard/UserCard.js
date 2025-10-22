import React, { useState } from 'react';
import './usercard.css'
import ToggleSwitch from '../../ToggleSwitch'; // Adjust path if needed
import { enableChatForUser, disableChatForUser } from '../../../../../../helpers/firebasehelpers';




export default function UserCard({ user, setSimpaticoMatch, getMatchBy, selectTheUser, selectedUser, showSelectedUser, hovered, removeMatch }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showMatchingOptions, setShowMatchingOptions] = useState(false)
  const [matchConfirmMessage, setMatchConfirmMessage] = useState(false)
  const [toolTip, setToolTip] = useState('')
  // =========================== GET THE LAST LOGIN AND ADD IT TO THE USER CARD FOR QUICK VIEWING ===========================

  const matchInputDisplaySwitch = (e) => {
    e.stopPropagation()
    setShowMatchingOptions(!showMatchingOptions)
  }

  const showDetailsDisplaySwitch = (e) => {
    e.stopPropagation()
    setShowDetails(!showDetails)
  }

  const matchConfirm = (e) => {
    e.stopPropagation()
    if (e.target.dataset.tooltip === "cause") {
      getMatchBy(user.uid, user.cause, user.kinship, "cause")
    } else if (e.target.dataset.tooltip === "kinship") {
      getMatchBy(user.uid, user.cause, user.kinship, "kinship")
    } else if (e.target.dataset.tooltip === "both") {
      getMatchBy(user.uid, user.cause, user.kinship, "both")
    } else if (e.target.dataset.tooltip === "none") {
      getMatchBy(user.uid, user.cause, user.kinship, "none")
    } else if (selectedUser.uid === user.uid) {
      alert("You can't match a user with themselves")
    } else if (e.target.attributes.useruid) {
      setShowMatchingOptions(false)
      setMatchConfirmMessage(true)
    }
  }

  const cancelMatchConfirm = (e) => {
    e.stopPropagation()
    setMatchConfirmMessage(false)
    setShowMatchingOptions(true)
  }

  const matchDoubleConfirm = (e, uid) => {
    e.stopPropagation()
    setMatchConfirmMessage(false)
    setSimpaticoMatch(uid, selectedUser.uid)
  }

  const changeHandler = (e) => {
    e.stopPropagation()
  }

  const userSelectionHandler = () => {
    if (matchConfirmMessage || showMatchingOptions) return
    selectTheUser(user)
  }

  const collapsed =
    <div className={
      selectedUser ? selectedUser.uid === user.uid ? hovered === true ? "user-card user-selected hovered" : "user-card user-selected" : "user-card" : "user-card"} onClick={userSelectionHandler}>
      <div className="card-header">
        <h3>{user.displayName}</h3>
        <div className={user.simpaticoMatch ? "matched" : "not-matched"}>
          <span className="card-label">{user.simpaticoMatch ? "Matched" : "Not Matched"}</span>
        </div>
      </div>

      <div className="card-content">
        <div className="card-row">
          <span className="card-label">Cause: </span>
          <span>&nbsp;{user.cause}</span>
        </div>
        <div className="card-row">
          <span className="card-label">Kinship: </span>
          <span>&nbsp;{user.kinship}</span>
        </div>
        <div className="card-row">
          <span className="card-label">UID: </span>
          <span>&nbsp;{user.uid}</span>
        </div>
        <div className="card-row">
          <span className="card-label">Match: </span>
          <span>&nbsp;{user.simpaticoMatch ? user.simpaticoMatch.displayName : "user not matched"}</span>
        </div>
        <div className="card-row">
          <span className="card-label">Chat Enabled:</span>
          <ToggleSwitch
            isOn={!user.chatDisabled}
            handleToggle={async () => {
              try {
                if (user.chatDisabled) {
                  await enableChatForUser(user.uid);
                } else {
                  await disableChatForUser(user.uid);
                }
              } catch (err) {
                console.error("❌ Failed to toggle chat:", err.message);
              }
            }}
          />
        </div>

        <div className="card-btn-container">
          {
            user.simpaticoMatch
              ? <button onClick={e => removeMatch(user)} className='card-btn'>Remove match</button>
              : <button onClick={matchInputDisplaySwitch} className='card-btn'>Matching options</button>
          }
          <button className="card-btn" onClick={showDetailsDisplaySwitch}>Show Details</button>
        </div>

        {showMatchingOptions === true ?
          <div className="match-container" >
            <div className='matching-btns-container'>
              <div className='manual-matching-options'>
                <button
                  className='match-button'
                  useruid={user.uid}
                  onMouseEnter={e => showSelectedUser(e, true)}
                  onMouseLeave={e => showSelectedUser(e, false)}
                  onClick={e => matchConfirm(e)}> {!selectedUser || selectedUser.uid === user.uid ? "Select a user" : `Match with: ${selectedUser.displayName}`}
                </button>
              </div>

              {toolTip ? <h5 className='tool-tip'>{toolTip}</h5> : <h5>Quick Matching options</h5>}
              <div className='quick-matching-options'>
                <button data-tooltip="cause"
                  onMouseEnter={e => setToolTip("Match by CAUSE")}
                  onMouseLeave={e => setToolTip("")}
                  onClick={e => matchConfirm(e)}
                >C</button>
                <button data-tooltip="kinship"
                  onMouseEnter={e => setToolTip("Match by KINSHIP")}
                  onMouseLeave={e => setToolTip("")}
                  onClick={e => matchConfirm(e)}
                >K</button>
                <button data-tooltip="both"
                  onMouseEnter={e => setToolTip("Match by KINSHIP & CAUSE")}
                  onMouseLeave={e => setToolTip("")}
                  onClick={e => matchConfirm(e)}
                >&</button>
                <button data-tooltip="none"
                  onMouseEnter={e => setToolTip("Match by NO MATCH")}
                  onMouseLeave={e => setToolTip("")}
                  onClick={e => matchConfirm(e)}
                >X</button>
              </div>
            </div>

          </div>
          : matchConfirmMessage === true ?
            <div className="match-container">
              <span className="match-confirm-message">Match this user with <strong>{selectedUser ? selectedUser.displayName : "No Selected User"}</strong> ?</span>
              <div className="match-confirm-btns">
                <button className="match-button" onClick={e => matchDoubleConfirm(e, user.uid)}>Confirm</button>
                <button className="match-button" onClick={e => cancelMatchConfirm(e)}>Cancel</button>
              </div>
            </div>
            : null}
      </div>

    </div>

  const expanded =
    <div className={
      selectedUser ? selectedUser.uid === user.uid ? hovered === true ? "user-card user-selected hovered" : "user-card user-selected" : "user-card" : "user-card"} onClick={userSelectionHandler}>
      <div className="card-header">
        <h3>{user.displayName}</h3>
        <div className={user.simpaticoMatch ? "matched" : "not-matched"}>
          <span className="card-label">{user.simpaticoMatch ? "Matched" : "Not Matched"}</span>
        </div>
      </div>

      <div className="card-content">
        <div className="card-row">
          <span className="card-label">Cause: </span>
          <span>&nbsp;{user.cause}</span>
        </div>
        <div className="card-row">
          <span className="card-label">Kinship: </span>
          <span>&nbsp;{user.kinship}</span>
        </div>
        <div className="card-row">
          <span className="card-label">UID: </span>
          <span>&nbsp;{user.uid}</span>
        </div>
        <div className="card-row">
          <span className="card-label">Match: </span>
          <span>&nbsp;{user.simpaticoMatch ? user.simpaticoMatch.displayName : "user not matched"}</span>
        </div>

        <div className="card-btn-container">
          {
            user.simpaticoMatch
              ? <button onClick={e => removeMatch(e, user)} className='card-btn'>Remove match</button>
              : <button onClick={matchInputDisplaySwitch} className='card-btn'>Matching options</button>
          }
          <button className="card-btn" onClick={showDetailsDisplaySwitch}>Show Details</button>
        </div>
        <div className="card-details">
          <div className="card-row">
            <span className="card-label">Loss Date:</span>
            <span>&nbsp;{user.lossDate}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Birth Date:</span>
            <span>&nbsp;{user.birthDate}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Email:</span>
            <span>&nbsp;{user.email}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Residence:</span>
            <span>&nbsp;{user.residence}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Household:</span>
            <span>&nbsp;{user.household}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Education:</span>
            <span>&nbsp;{user.education}</span>
          </div>
          {/* <div className="card-row">
            <span className="card-label">Hobbies:</span>
            <span>&nbsp;{truncate(user.hobbies, 50)}</span>
          </div>


          Should these be here? In this needed in the admin? Maytbe we should just add a button for optioal viewing? these are the two open ended fields that can have a lot of content.

          <div className="card-row">
            <span className="card-label">Loss Experience:</span>
            <span>&nbsp;{truncate(user.lossExp, 50)}</span>
          </div> */}
          <div className="card-row">
            <span className="card-label">BioSex:</span>
            <span>&nbsp;{user.bioSex}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Race:</span>
            <span>&nbsp;{user.race}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Ethnicity:</span>
            <span>&nbsp;{user.ethnicity}</span>
          </div>
        </div>
        {showMatchingOptions === true ?
          <div className="match-container" >
            <div className='matching-btns-container'>
              <h5>Manual Matching options</h5>
              <div className='manual-matching-options'>
                <button
                  className='match-button'
                  useruid={user.uid}
                  onMouseEnter={e => showSelectedUser(e, true)}
                  onMouseLeave={e => showSelectedUser(e, false)}
                  onClick={e => matchConfirm(e)}> {!selectedUser || selectedUser.uid === user.uid ? "Select a user" : `Match with: ${selectedUser.displayName}`}
                </button>
                <span>or</span>
                <div className="sub-container">
                  <input className="uid-input" type='text' placeholder='Enter UID'
                    onChange={changeHandler}></input>
                  <button className="uid-button" onClick={e => matchConfirm(e)}>Match</button>
                </div>
              </div>

              {toolTip ? <h5 className='tool-tip'>{toolTip}</h5> : <h5>Random Matching options</h5>}
              <div className='quick-matching-options'>
                <button data-tooltip="Match by CAUSE only"
                  onMouseEnter={e => setToolTip("Match by CAUSE")}
                  onMouseLeave={e => setToolTip("")}
                >C</button>
                <button data-tooltip="Match by KINSHIP only"
                  onMouseEnter={e => setToolTip("Match by KINSHIP")}
                  onMouseLeave={e => setToolTip("")}
                >K</button>
                <button data-tooltip="Match by KINSHIP and CAUSE"
                  onMouseEnter={e => setToolTip("Match by KINSHIP & CAUSE")}
                  onMouseLeave={e => setToolTip("")}
                >&</button>
                <button data-tooltip="Match by NO MATCH"
                  onMouseEnter={e => setToolTip("Match by NO MATCH")}
                  onMouseLeave={e => setToolTip("")}
                >X</button>
              </div>
            </div>

          </div>
          : matchConfirmMessage === true ?
            (!selectedUser) || (user.uid === selectedUser.uid) ?
              <div className="match-container">
                <span className="match-confirm-message">Match this user with UID: ?</span>
                <div className="match-confirm-btns">
                  <button className="match-button" onClick={e => matchDoubleConfirm(e, user.uid)}>Confirm</button>
                  <button className="match-button" onClick={e => cancelMatchConfirm(e)}>Cancel</button>
                </div>
              </div>

              : <div className="match-container">
                <span className="match-confirm-message">Match this user with <strong>{selectedUser.displayName}</strong> ?</span>
                <div className="match-confirm-btns">
                  <button className="match-button" onClick={e => matchDoubleConfirm(e, user.uid)}>Confirm</button>
                  <button className="match-button" onClick={e => cancelMatchConfirm(e)}>Cancel</button>
                </div>
              </div>
            : null}
      </div>

    </div>

  return (
    <div>
      {showDetails ? expanded : collapsed}
    </div>
  );
};
