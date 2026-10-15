export function moderationStatusOf(convo) {
  const raw = convo?.moderationStatus || convo?.moderation_status;
  if (raw === 'paused' || raw === 'terminated') return raw;
  return 'active';
}

export function isConversationMessagingBlocked(convo) {
  const status = moderationStatusOf(convo);
  return status === 'paused' || status === 'terminated';
}

export function moderationBannerText(convo) {
  const status = moderationStatusOf(convo);
  if (status === 'paused') {
    return 'This conversation is paused. You can still read messages, but neither of you can send new ones until the study team resumes it.';
  }
  if (status === 'terminated') {
    return 'This conversation has been ended by the study team. You can still read past messages, but new messages cannot be sent.';
  }
  return '';
}
