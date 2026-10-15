import React from 'react';
import en from '../../../translations/en';
import {
  STUDY_SUPPORT_EMAIL,
  TUTORIAL_VIDEO_URL,
} from '../../../constants';

function youtubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function TutorialSlot({ url, placeholder }) {
  if (!url) {
    return (
      <div className="waiting-hub-video-placeholder" role="img" aria-label={placeholder}>
        {placeholder}
      </div>
    );
  }

  const yt = youtubeEmbedUrl(url);
  if (yt) {
    return (
      <div className="waiting-hub-video">
        <iframe
          title="Study tutorial"
          src={yt}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <video className="waiting-hub-video" controls src={url}>
      {placeholder}
    </video>
  );
}

export default function WaitingHub({ displayName }) {
  const t = en;
  const name = displayName || 'there';

  return (
    <div className="waiting-hub">
      <header className="waiting-hub-intro">
        <h2>{t.messageWindow.unmatchedTitle.replace('{name}', name)}</h2>
        <p>{t.messageWindow.unmatchedLine1}</p>
        <p>{t.messageWindow.unmatchedLine2}</p>
      </header>

      {TUTORIAL_VIDEO_URL ? (
        <section className="waiting-hub-card">
          <h3>{t.waitingHub.tutorialTitle}</h3>
          <TutorialSlot
            url={TUTORIAL_VIDEO_URL}
            placeholder={t.waitingHub.tutorialPlaceholder}
          />
        </section>
      ) : null}

      <section className="waiting-hub-card">
        <h3>{t.waitingHub.purposeTitle}</h3>
        <p>{t.waitingHub.purpose}</p>
      </section>

      <section className="waiting-hub-card">
        <h3>{t.waitingHub.contactsTitle}</h3>
        <p>
          <strong>{t.waitingHub.supportLabel}</strong>
          <br />
          <a href={`mailto:${STUDY_SUPPORT_EMAIL}`}>{STUDY_SUPPORT_EMAIL}</a>
        </p>
        <p className="waiting-hub-assessments">{t.waitingHub.assessmentsNote}</p>
      </section>
    </div>
  );
}
