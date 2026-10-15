import React, { useMemo } from 'react';
import { RxCaretRight } from 'react-icons/rx';
import { IconContext } from 'react-icons';
import {
  createSupportConvoIfMissing,
  getSupportConvoIfExists,
} from '../../../services/matchService';
import { getSupportUid } from '../../../constants';

const sharepairImg = `${process.env.PUBLIC_URL}/eardpairtransparentbg.png`;
const supportImg = `${process.env.PUBLIC_URL}/sharepairslogo.png`;

function supportContact() {
  return {
    uid: getSupportUid(),
    displayName: 'Study Support',
    photoURL: 'https://api.dicebear.com/5.x/thumbs/svg?seed=Angel',
    type: 'support',
  };
}

export default function ContactsList({
  contacts,
  onContactClick,
  userData,
  setActiveConversation,
  setShowDistressThermometer,
  activeConvo = [],
  onRequestSent,
  setSystemMessage,
}) {
  const myUid = userData?.authId || userData?.uid;

  // Always show Study Support + current match (even if contacts[] is stale on live)
  const displayContacts = useMemo(() => {
    const list = Array.isArray(contacts) ? [...contacts] : [];
    const supportUid = getSupportUid();
    if (myUid === supportUid) return list.filter((c) => c?.uid !== supportUid);

    const match = userData?.simpaticoMatch;
    const matchUid =
      typeof match === 'string' ? match : match?.uid || match?.authId || null;
    if (matchUid && matchUid !== myUid) {
      const hasMatch = list.some(
        (c) => c?.uid === matchUid || c?.authId === matchUid
      );
      if (!hasMatch) {
        list.unshift({
          uid: matchUid,
          displayName:
            (typeof match === 'object' &&
              (match.displayName || match.display_name || match.email)) ||
            '',
          photoURL:
            (typeof match === 'object' &&
              (match.photoURL || match.photo_url)) ||
            '',
          type: 'match',
        });
      }
    }

    const withoutStaleSupport = list.filter(
      (c) => c?.type !== 'support' || c?.uid === supportUid || c?.authId === supportUid
    );
    list.length = 0;
    list.push(...withoutStaleSupport);
    const hasSupport = list.some((c) => c?.uid === supportUid || c?.authId === supportUid);
    if (!hasSupport) list.unshift(supportContact());
    return list;
  }, [contacts, myUid, userData?.simpaticoMatch]);

  const getImage = (type, photoURL) => {
    if (type === 'sharepair') return sharepairImg;
    if (type === 'support') return supportImg;
    return photoURL || supportImg;
  };

  const openSupportConvo = (convo) => {
    if (!convo?.docID) {
      throw new Error('Support conversation response missing docID');
    }
    setActiveConversation({
      ...convo,
      otherUserUid: getSupportUid(),
      type: convo.type || 'support',
      mutualConsent: true,
    });
    setShowDistressThermometer?.(false);
  };

  const handleSupportClick = async () => {
    if (!myUid) {
      setSystemMessage?.({
        type: 'alert',
        message: 'Please sign in again to message Study Support.',
      });
      return;
    }

    try {
      const existing = await getSupportConvoIfExists();
      if (existing?.docID) {
        openSupportConvo(existing);
        return;
      }

      setSystemMessage?.({
        type: 'confirm',
        message: 'Do you want to start a conversation with Study Support?',
        actionLabel: 'Yes',
        action: async () => {
          try {
            const convo = await createSupportConvoIfMissing();
            openSupportConvo(convo);
            setSystemMessage(null);
          } catch (e) {
            console.error('support convo failed:', e);
            setSystemMessage({
              type: 'alert',
              message:
                e?.message ||
                "Couldn't start a support conversation. Please try again.",
            });
          }
        },
      });
    } catch (e) {
      console.error('support check failed:', e);
      setSystemMessage?.({
        type: 'alert',
        message: e?.message || "Couldn't check your support conversation. Please try again.",
      });
    }
  };

  const handleContactClick = (contact) => {
    if (contact.type === 'support' || contact.uid === getSupportUid()) {
      return handleSupportClick();
    }
    onContactClick(contact);
  };

  return (
    <IconContext.Provider value={{ className: 'react-icons-contacts' }}>
      <div className="contacts-list">
        {displayContacts.map((contact) => {
          const contactUid = contact.uid || contact.authId;

          return (
            <div
              key={contactUid}
              className="chatroom-item"
              onClick={() => handleContactClick(contact)}
              role="button"
              tabIndex={0}
            >
              <div className="img-container">
                <img
                  className="profile-image"
                  alt={`Profile of ${contact.displayName}`}
                  src={getImage(contact.type, contact.photoURL)}
                />
              </div>

              <div className="contact-body">
                <h3>{contact.displayName}</h3>
                <div className="convo-starter">
                  <RxCaretRight />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </IconContext.Provider>
  );
}
