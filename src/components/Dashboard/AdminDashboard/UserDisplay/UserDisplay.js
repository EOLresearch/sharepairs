import React, { useState, useMemo, useCallback } from 'react';
import UserCardFilterContainer from './UserCardFilterContainer/UserCardFilterContainer';
import './userdisplay.css';
import { updateMatch, removeMatch } from '../../../../helpers/firebasehelpers';
import { KINSHIP_OPTIONS_EN } from '../../../../helpers/optionsArrays';

function getMatchUidFromField(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field.uid || field.authId || null;
  return null;
}

function UserDisplay({
  users,
  allUsers,
  causeFilter,
  setCauseFilter,
  kinshipFilter,
  setKinshipFilter,
  showKinshipFilters,
  setShowKinshipFilters,
  handleExportCSV,
  handleExportConversations,
}) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [busy, setBusy] = useState(false);

  const unmatchedUsers = useMemo(
    () => (Array.isArray(allUsers) ? allUsers.filter(u => !getMatchUidFromField(u.simpaticoMatch)) : []),
    [allUsers]
  );

  const selectTheUser = useCallback((user) => setSelectedUser(user), []);
  const showSelectedUser = useCallback((_, boolean) => setHovered(boolean), []);

  const getMatchBy = useCallback((uid, userCause, userKinship, type) => {
    const preds = {
      cause: (u) => u.cause === userCause && u.uid !== uid,
      kinship: (u) => u.kinship === userKinship && u.uid !== uid,
      both: (u) => u.cause === userCause && u.kinship === userKinship && u.uid !== uid,
      none: (u) => u.cause !== userCause && u.kinship !== userKinship && u.uid !== uid,
    };
    const match = unmatchedUsers.find(preds[type]);
    if (!match) return alert('No match available');
    setSelectedUser(match);
  }, [unmatchedUsers]);

  const setSimpaticoMatch = useCallback(async (useruid, selecteduid) => {
    if (!useruid || !selecteduid) return alert("Both users must be selected.");
    if (useruid === selecteduid) return alert("Cannot match a user with themselves.");
    try {
      setBusy(true);
      await updateMatch(useruid, selecteduid);
      setHovered(false);
      // live snapshot will refresh cards
    } catch (err) {
      console.error("Failed to set match:", err);
      alert("Match failed. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleRemoveMatch = useCallback(async (user) => {
    try {
      setBusy(true);
      const otherUid = getMatchUidFromField(user?.simpaticoMatch);
      const ops = [removeMatch(user.uid)];
      if (otherUid) ops.push(removeMatch(otherUid));
      await Promise.all(ops);
      setHovered(false);
    } catch (err) {
      console.error('Remove match failed:', err);
      alert('Remove match failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  const filterHandler = useCallback((filterCondition) => {
    const actions = {
      'All': () => { setKinshipFilter('All'); setCauseFilter('All'); },
      'Natural': () => setCauseFilter('Natural'),
      'Unnatural': () => setCauseFilter('Unnatural'),
      'Kinship': () => setShowKinshipFilters(prev => !prev),
      default: () => setKinshipFilter(filterCondition)
    };
    (actions[filterCondition] || actions.default)();
  }, [setCauseFilter, setKinshipFilter, setShowKinshipFilters]);

  return (
    <div className="user-display-container">
      <div className='user-display-header'>
        <div className='user-display-cause-selections'>
          {['Kinship', 'Natural', 'Unnatural', 'All'].map(filter => (
            <button key={filter} onClick={() => { filterHandler(filter); setKinshipFilter('All'); }} disabled={busy}>
              {filter === 'Kinship' ? (showKinshipFilters ? 'Hide Filters' : 'Show Filters') : filter}
            </button>
          ))}
        </div>
      </div>

      <div className="user-display-body">
        {showKinshipFilters && (
          <div className="kinship-selections">
            <div className='filter-labels-container'>
              <span>Cause: <span>{causeFilter}</span></span>
              <button onClick={handleExportCSV} className="admin-export-button" disabled={busy}>
                Export Filtered User Data to CSV
              </button>
              <span>Kinship: <span>{kinshipFilter}</span></span>
            </div>
            <div className='double-btn-container'>
              {KINSHIP_OPTIONS_EN.map(kinship => (
                <div key={kinship} className='double-btn'>
                  <span onClick={() => { filterHandler(kinship); setCauseFilter("All"); }}>{kinship}</span>
                  <div className='sub-btn-container'>
                    <button onClick={() => { setCauseFilter('Natural'); setKinshipFilter(kinship); }} disabled={busy}>N</button>
                    <button onClick={() => { setCauseFilter('Unnatural'); setKinshipFilter(kinship); }} disabled={busy}>U</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(users) ? (
          <UserCardFilterContainer
            users={users}
            hovered={hovered}
            selectTheUser={selectTheUser}
            showSelectedUser={showSelectedUser}
            getMatchBy={getMatchBy}
            setSimpaticoMatch={setSimpaticoMatch}
            removeMatch={handleRemoveMatch}
            selectedUser={selectedUser}
            busy={busy}
          />
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}

export default UserDisplay;
