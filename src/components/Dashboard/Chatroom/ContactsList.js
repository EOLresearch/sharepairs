import React from 'react';
import { RxCaretRight } from "react-icons/rx";
import { IconContext } from 'react-icons';
import sharepairImg from '../../../assets/eardpairtransparentbg.png';
import supportImg from '../../../assets/simpaticologogreenbg.jpg';
import { createSupportConvoIfMissing, getSupportConvoIfExists } from '../../../helpers/firebasehelpers'; // 👈 added
// If you already export SUPPORT_UID you can import it too, not required here.

export default function ContactsList({
  contacts,
  onContactClick,
  userData,
  setActiveConversation,
  setShowDistressThermometer,
  activeConvo = [],
  onRequestSent,
  setSystemMessage
}) {
  const getImage = (type, photoURL) => {
    if (type === 'sharepair') return sharepairImg;
    if (type === 'support') return supportImg;
    return photoURL || supportImg;
  };

  // Open existing Support conversation if present; otherwise ask to create
  const handleSupportClick = async () => {
    try {
      // 1) Try to find an existing support thread
      const existing = await getSupportConvoIfExists(userData.authId);
      if (existing) {
        setActiveConversation(existing);
        setShowDistressThermometer?.(false);
        return;
      }

      // 2) No existing convo — ask before creating
      setSystemMessage?.({
        type: "confirm",
        message: "Do you want to start a conversation with support?",
        actionLabel: "Yes",
        action: async () => {
          try {
            const convo = await createSupportConvoIfMissing(userData.authId);
            setActiveConversation(convo);
            setShowDistressThermometer?.(false);
          } catch (e) {
            console.error("support convo failed:", e);
            setSystemMessage({
              type: "alert",
              message: "Couldn’t start a support conversation. Please try again."
            });
            return;
          } finally {
            setSystemMessage(null);
          }
        }
      });
    } catch (e) {
      console.error("support check failed:", e);
      setSystemMessage?.({
        type: "alert",
        message: "Couldn’t check your support conversation. Please try again."
      });
    }
  };

  const handleContactClick = (contact) => {
    if (contact.type === "support") {
      return handleSupportClick();
    }
    onContactClick(contact);
  };

  return (
    <IconContext.Provider value={{ className: "react-icons-contacts" }}>
      <div className="contacts-list">
        {contacts.map((contact) => {
          const contactUid = contact.uid || contact.authId;
          const isMutuallyConsented = activeConvo.some(
            c => c.users?.includes(contactUid) && c.mutualConsent
          );

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
