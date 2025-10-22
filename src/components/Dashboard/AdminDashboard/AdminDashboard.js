import './admindashboard.css';
import UserDisplay from './UserDisplay/UserDisplay';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../UserAuth/AuthContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../fb';
import Papa from 'papaparse';
import { getAllConversations } from '../../../helpers/firebasehelpers';

function filterUsers(users, causeFilter, kinshipFilter) {
  if (!Array.isArray(users)) return [];
  if (causeFilter === 'All' && kinshipFilter === 'All') return users;
  return users.filter((user) => {
    const cause = user?.cause || 'Unknown';
    const kinship = user?.kinship || 'Unknown';
    if (causeFilter !== 'All' && cause !== causeFilter) return false;
    if (kinshipFilter !== 'All' && kinship !== kinshipFilter) return false;
    return true;
  });
}

function AdminDashboard({ userData, navHandler }) {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [causeFilter, setCauseFilter] = useState('All');
  const [kinshipFilter, setKinshipFilter] = useState('All');
  const [showKinshipFilters, setShowKinshipFilters] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // redirect non-admins out
  useEffect(() => {
    if (user && !userData?.admin) navHandler?.('Home');
  }, [user, userData, navHandler]);

  // live subscribe to users
  useEffect(() => {
    if (!userData?.admin) return;
    setIsLoadingUsers(true);
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      setAllUsers(users);
      setIsLoadingUsers(false);
    }, () => setIsLoadingUsers(false));
    return () => unsub();
  }, [userData?.admin]);

  const filteredUsers = useMemo(
    () => filterUsers(allUsers, causeFilter, kinshipFilter),
    [allUsers, causeFilter, kinshipFilter]
  );

  const handleExportCSV = useCallback(() => {
    if (!filteredUsers.length) {
      alert('No users to export.');
      return;
    }
    const exportData = filteredUsers.map(user => {
      const { simpaticoMatch, contacts, createdAt, updatedAt, ...rest } = user || {};
      const matchName =
        typeof simpaticoMatch === 'string'
          ? simpaticoMatch
          : (simpaticoMatch?.displayName || simpaticoMatch?.uid || '');
      return {
        ...rest,
        simpaticoMatch: matchName,
        contacts: Array.isArray(contacts)
          ? contacts.map(c => `${c.displayName || 'Unknown'} (${c.authId || c.uid || 'no-id'})`).join(', ')
          : '',
        createdAt: createdAt?.toDate?.().toLocaleString?.() || '',
        updatedAt: updatedAt?.toDate?.().toLocaleString?.() || '',
      };
    });
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'filtered_users.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [filteredUsers]);

  const handleExportConversations = useCallback(async () => {
    try {
      const conversations = await getAllConversations();
      if (!conversations?.length) {
        alert('No conversations found.');
        return;
      }
      const exportData = conversations.map(convo => {
        const { createdAt, updatedAt, users, lastSeen, consentGivenBy, ...rest } = convo || {};
        return {
          ...rest,
          docID: convo.docID,
          users: Array.isArray(users) ? users.join(', ') : '',
          consentGivenBy: Array.isArray(consentGivenBy) ? consentGivenBy.join(', ') : '',
          lastSeen: lastSeen ? JSON.stringify(lastSeen) : '',
          createdAt: createdAt?.toDate?.().toLocaleString?.() || '',
          updatedAt: updatedAt?.toDate?.().toLocaleString?.() || '',
        };
      });
      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', 'conversations.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('❌ Error exporting conversations:', err);
      alert('Export failed. See console for details.');
    }
  }, []);

  return (
    <div className='admin-dashboard-container'>
      <div className='admin-dashboard'>
        <div className='admin-dashboard-header'>
          <button disabled className="admin-load-button">
            {isLoadingUsers ? 'Loading…' : 'Live'}
          </button>
          <button onClick={handleExportCSV} disabled={!filteredUsers.length}>
            Export Filtered Users CSV
          </button>
          <button onClick={handleExportConversations}>
            Export Conversations CSV
          </button>
        </div>

        <div className='admin-dashboard-body'>
          <UserDisplay
            users={filteredUsers}
            allUsers={allUsers}
            causeFilter={causeFilter}
            setCauseFilter={setCauseFilter}
            kinshipFilter={kinshipFilter}
            setKinshipFilter={setKinshipFilter}
            showKinshipFilters={showKinshipFilters}
            setShowKinshipFilters={setShowKinshipFilters}
            handleExportCSV={handleExportCSV}
            handleExportConversations={handleExportConversations}
          />
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
