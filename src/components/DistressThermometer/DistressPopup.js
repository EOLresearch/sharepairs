import React from 'react';
import './DistressPopup.css';
import griefPDF from '../../assets/grief.pdf';
import mentalHealthPDF from '../../assets/mentalhealthsupport.pdf';
import fullResourcePDF from '../../assets/resources.pdf';

const getMessageForLevel = (level) => {
  if (level >= 100) {
    return {
      label: '100 – Unbearably upset, can’t function',
      intro: `Based on your response, we want to first make sure that you have the best support to ensure your safety and well-being.`,
      crisis: `If you or someone you know is at risk of harming themselves or others, please contact emergency services by calling 9-1-1 or going to the emergency room at the hospital closest to you.`,
      showCrisisFirst: true
    };
  }
  if (level >= 90) {
    return {
      label: '90 – Extremely distressed',
      intro: `Based on your response, we want to first make sure that you have the best support to ensure your safety and well-being.`,
      crisis: `If you or someone you know is at risk of harming themselves or others, please contact emergency services by calling 9-1-1 or going to the emergency room at the hospital closest to you.`,
      showCrisisFirst: true
    };
  }
  if (level >= 80) {
    return {
      label: '80 – Very distressed',
      intro: `Based on your response, we want to provide you with some additional resources that may be better able to address your current distress levels that are interfering with functioning.`,
      crisis: `If you or someone you know is at risk of harming themselves or others, please contact emergency services by calling 9-1-1 or going to the emergency room at the hospital closest to you.`,
      showCrisisFirst: false
    };
  }
  if (level >= 70) {
    return {
      label: '70 – Quite distressed',
      intro: `We’re glad you’re here! Based on your response, we want to provide you with some additional resources that may be better able to address your current distress levels that are interfering with functioning.`,
      crisis: `If you or someone you know is at risk of harming themselves or others, please contact emergency services by calling 9-1-1 or going to the emergency room at the hospital closest to you.`,
      showCrisisFirst: false
    };
  }
  return null;
};

const NonCrisisSupport = () => (
  <details>
    <summary>Non-Crisis Emotional Support</summary>
    <p>
      For non-crisis emotional support, you can call local and national warm lines at{' '}
      <a href="https://warmline.org" target="_blank" rel="noopener noreferrer">warmline.org</a>
    </p>
    <p>
      If you’ve been feeling higher levels of distress more often than not, you may benefit from connecting with a mental health professional. You can:
    </p>
    <ul>
      <li>
        <a href={griefPDF} target="_blank" rel="noopener noreferrer">
          For grief and bereavement-related support resources click here
        </a>
      </li>
      <li>Ask your primary care doctor for a referral</li>
      <li>If you have health insurance, contact your insurer for a list of covered mental health providers near you</li>
      <li>
        Search for providers on{' '}
        <a href="https://www.psychologytoday.com" target="_blank" rel="noopener noreferrer">
          PsychologyToday.com
        </a>
      </li>
      <li>
        <a href={mentalHealthPDF} target="_blank" rel="noopener noreferrer">
          Click here for additional resources for finding mental health care
        </a>
      </li>
    </ul>
  </details>
);

const CrisisSupport = () => (
  <details>
    <summary>Additional Crisis Support & Hotlines</summary>
    <ul>
      <li><strong>988 Lifeline:</strong> Call or text <a href="tel:988">988</a> or chat at{' '}
        <a href="https://988lifeline.org" target="_blank" rel="noopener noreferrer">988lifeline.org</a>
      </li>
      <li><strong>The Trevor Project:</strong> Call{' '}
        <a href="tel:866-488-7386">866-488-7386</a>, text START to 678678, or visit{' '}
        <a href="https://thetrevorproject.org/get-help" target="_blank" rel="noopener noreferrer">
          thetrevorproject.org
        </a>
      </li>
      <li>
        <strong>Download full resource list:</strong>{' '}
        <a href={fullResourcePDF} target="_blank" rel="noopener noreferrer">Click here</a>
      </li>
    </ul>
  </details>
);

export default function DistressPopup({ setShowDistressPopup, distressLevel }) {
  const content = getMessageForLevel(distressLevel);

  if (!content) return null;

  return (
    <div className="welcome-message-overlay">
      <div className=" distress-popup">
        <h2>You responded: {content.label}</h2>
        <p>{content.intro}</p>

        {content.showCrisisFirst ? (
          <>
            <p>{content.crisis}</p>
            <CrisisSupport />
            <NonCrisisSupport />
          </>
        ) : (
          <>
            <NonCrisisSupport />
            <p>{content.crisis}</p>
            <CrisisSupport />
          </>
        )}

        <p>
          <em>
            Note: A member of the study team will reach out within <strong>24-48 hours</strong> to check in. If your distress resolves before then, feel free to log back in to Share Pairs.
          </em>
        </p>

        <button onClick={() => setShowDistressPopup(false)}>Close</button>
      </div>
    </div>
  );
}
