import { useState } from 'react';

function IRBoverlay({ setIRBinstructions }) {
  return (
    <div className="welcome-message irb">
      <div className='header'>
        <h3>Welcome, IRB Reviewer</h3>
        <button className='close-btn' onClick={() => setIRBinstructions(false)}>X</button>
      </div>
      <div className='irb-instructions'>
        <p>
          This is a **clickable prototype** of <strong>Share Pairs</strong>, a chat application designed to match users based on shared experiences of loss. The purpose of this prototype is to demonstrate how we will protect users' privacy, ensure ethical interactions, and comply with IRB standards.
        </p>
        <p>
          As you navigate, please note that this is a simulation—no real user data is collected, and all interactions are pre-defined to illustrate key safeguards.
        </p>
        <p>
          Key user protection measures include:
        </p>
        <ul>
          <li><strong>Anonymous Matching</strong> – Users are connected based on shared circumstances, without exposing personal details upfront.</li>
          <li><strong>Moderation & Reporting</strong> – Features are in place to flag inappropriate behavior and ensure a safe environment.</li>
          <li><strong>Emotional Check-Ins</strong> – Along with monitoring user interactions, we actively check in with users about their own emotional state before they enter a potentially distressing conversation, allowing them to assess and reflect on their feelings.</li>
        </ul>

        <div className="study-support-message">
          <p style={{ margin: "0" }}>
            <strong>Secure Data Handling:</strong> User data is stored in a <strong>WCM-ITS controlled AWS instance</strong> under a <strong>Business Associate Agreement (BAA)</strong>. 
            HIPAA compliance is assured through the use of <strong>secure communication protocols (e.g., TLS/SSL)</strong>, strict access controls, and encryption to protect privacy.
          </p>
        </div>

        <p>
          This is a prototype and not a fully functional application. Your feedback is invaluable in refining our approach to user safety and ethical standards.
          <br /> <br />
          To log in, you can enter anything as a username and password. For example, you can use "test" for both fields.
        </p>
      </div>
    </div>
  );
}

export default IRBoverlay;
