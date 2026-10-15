const en = {
  welcome: {
    hello_user: "Hello, {{name}}",
    thank_you: "Thank you for joining Share Pairs.",
    intro_1: "This application is designed for you to create positive social interactions with others who have experienced a similar loss. We ask that you log in at least once a day to chat with your Simpatico Match.",
    intro_2: "Our goal is to help you find someone who can relate to your loss. We hope that you will find comfort in sharing your story and listening to the stories of others. We are here to help you through your grief journey.",
    left_panel: "On the left side, you will find your active conversations and contacts list. Each side can be collapsed or expanded.",
    center_panel: "In the center, you will find the main chat window.",
    right_panel: "On the right side, you will find information about your Simpatico Match and some prompts to help get the conversation started."
  },
  support: {
    contact_message:
      "If you have any issues with the application or chatting with your Simpatico Match, please reach out to Study Support via your Contacts pane."
  },
  auth: {
    login_title: "Login",
    email_placeholder: "Email",
    password_placeholder: "Password",
    study_login_hint: "Use the email you gave the study team. Your password is the access code they gave you, until you change it.",
    login_button: "Login",
    logging_in: "Logging in...",
    forgot_password: "Forgot Password?",
    join_prompt: "Not a member? ",
    join_now: "Join now",
    error_unverified: "Please verify your email before logging in.",
    error_invalid_credentials: "Invalid email or password.",
    error_generic: "Login failed. Please try again."
  },
  verify: {
    title: "Verify your email",
    sent_prefix: "We sent a verification code to",
    instructions: "Enter the 6-digit code from your email. After verifying you can use the app.",
    code_placeholder: "6-digit code",
    verify_button: "Verify",
    verifying: "Verifying...",
    resend_button: "Resend code",
    sign_out: "Sign out",
    error_generic: "Verification failed. Check the code and try again.",
    error_resend: "Could not resend the code. Please try again."
  },
  forgot: {
    instructions: "Please submit the email address associated with your account",
    placeholder_email: "Email",
    send_button: "Send Password Reset",
    sending: "Sending...",
    back_to_login: "Back to Login",
    status_sent: "Password reset email sent!",
    error_not_found: "No account found with that email.",
    error_generic: "Failed to send reset email."
  },
  register: {
    sections: {
      account_info: "Account Info",
      personal_info: "Personal Info",
      your_story: "Your Story",
      intake: "Intake"
    },
    labels: {
      email: "Email",
      email_screening_hint: "Use the same email address you used on the eligibility survey so the study team can find that record. Using the same email does not confirm eligibility or consent. You still verify this account and agree here.",
      invite_code: "Invite code from the study team",
      password: "Password",
      confirm_password: "Confirm Password",
      display_name: "Display Name",
      country: "Country",
      home_state: "Home State",
      birth_date: "Birth Date",
      race: "What race best describes you?",
      ethnicity: "What ethnicity best describes you?",
      bio_sex: "Biological Sex",
      education: "Level of Education",
      household: "Please describe your living situation.",
      hobbies: "Tell us some of your hobbies",
      loss_date: "What date did you experience your loss?",
      kinship: "Relationship to the deceased",
      cause: "Cause of Death",
      deceased_age: "How old were they?",
      loss_experience: "Please describe your loss experience",
      consent_label: "By clicking this checkbox, I agree to share the above information and allow other users to view the information I shared."
    },
    hints: {
      cause: "Natural: e.g. cancer, illness\nUnnatural: e.g. car accident, homicide, suicide."
    },
    visibility: {
      partner_badge: "Visible to your Simpatico Match",
      partner_note: "Fields marked “Visible to your Simpatico Match” can be seen by your partner. Other information is only for the study team."
    },
    buttons: {
      submit: "Submit",
      submitting: "Submitting...",
      back_to_login: "Back to Login",
      return_home: "Return to Home"
    },
    errors: {
      missing_email: "Missing email address.",
      missing_invite: "An invite code from the study team is required.",
      missing_password: "Password is required.",
      password_mismatch: "Passwords do not match.",
      weak_password: "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.",
      missing_residence: "Home state is required.",
      missing_birthdate: "Birth date is required.",
      must_be_18: "You must be at least 18 years old to register.",
      missing_race: "Race selection is required.",
      missing_ethnicity: "Ethnicity selection is required.",
      missing_bio_sex: "Biological sex is required.",
      missing_education: "Education level is required.",
      missing_household: "Living situation is required.",
      missing_loss_date: "Loss date is required.",
      missing_kinship: "Relationship to deceased is required.",
      missing_cause: "Cause of death is required.",
      missing_deceased_age: "Deceased age is required.",
      missing_loss_experience: "Loss experience is required.",
      missing_consent: "You must consent to share your information.",
      missing_inq: "Please answer every INQ question.",
      missing_cssrs: "Please answer the screening question.",
      intake_unavailable: "The intake questions could not be loaded. Please refresh and try again.",
      email_in_use: "This email is already in use.",
      invalid_invite: "Invite code is invalid or already used.",
      generic: "Registration failed. Please try again.",
      success: "Verification email sent. Please check your inbox and log in after verifying."
    },

  },
  left_panel: {
    contacts: "Contacts",
    conversations: "Convos"
  },
  right_panel: {
    info: "Info",
    prompts: "Prompts"
  },
  info_panel: {
    lives_in: "Lives in",
    unknown: "Unknown",
    story_title: "Your Simpatico Match's story:",
    no_story: "They haven’t shared a story yet.",
    non_match: "This person is one of your contacts. Start a conversation below."
  },
  convo_btn: {
    request: "Request Conversation",
    pending: "Request Pending",
    open: "Conversation is Open",
    reopen: "Open Conversation",
    open_prompt: "Open conversation with {name}?",
    request_sent: "Conversation request sent to {name}.",
    error: "Something went wrong sending the request to {name}. Try again later."
  },
  chatroom: {
    new_request: '{name} has requested to start a conversation. Click to accept.',
    new_match: '🎉 You have a Simpatico Match! View the contacts panel to see them.',
    start_prompt: 'Do you want to start a conversation with {name}?',
    request_accepted: '{name} has accepted the conversation. Open it now?',
    already_active: 'This conversation is already active.',
    not_accepted: "This conversation hasn't been accepted by both users yet.",
  },
  distress: {
    title: "Distress Thermometer",
    instructions: "Before you start or continue your conversation with your Simpatico Match, please click on the number that best describes your current level of distress.",
    levels: {
      100: "Unbearably upset, can’t function",
      90: "Extremely distressed",
      80: "Very distressed, trouble focusing",
      70: "Quite distressed, discomfort interfering with functioning",
      60: "Moderate to strong distress",
      50: "Moderate distress, uncomfortable but functional",
      40: "Mild to moderate distress",
      30: "Mild distress but able to function",
      20: "Slightly distressed, sad or anxious",
      10: "No distress, alert, concentrating",
      0: "Peace, no distress, complete calm"
    },
    
  },
  messageWindow: {
    unmatchedTitle: "Welcome, {name}.",
    unmatchedLine1: "We're still working to find your Simpatico Match — someone who shares a similar experience.",
    unmatchedLine2: "While you wait, browse the prompts on the right and message Study Support in Contacts. Your match will show up in Contacts when the study team pairs you.",
    noConversationTitle: "Select a conversation",
    noConversationLine: "Your messages will appear here.",
    loadMore: "Load More",
    noMessages: "No messages yet. Start the conversation!",
    loadingMessages: "Loading messages…",
    inputPlaceholder: "Type a message",
    send: "Send",
    pausedSend: "Messaging is paused for this conversation.",
    terminatedSend: "This conversation has been ended."
  },
  waitingHub: {
    tutorialTitle: "Study tutorial",
    tutorialPlaceholder: "Tutorial video coming soon.",
    purposeTitle: "About this study",
    purpose:
      "Share Pairs is a research study that pairs people who have experienced a similar loss so they can talk with someone who understands grief from the inside. There is no required agenda — you share as much or as little as feels right. The study team is learning whether this kind of peer support can help people through bereavement.",
    contactsTitle: "Study contacts",
    supportLabel: "Study Support",
    yukaPlaceholderNote: "Contact details below are placeholders and will be updated.",
    assessmentsNote: "If you have a study questionnaire due, open Assessments from the menu at the top."
  },
  profile: {
    title: "Your profile",
    subtitle: "Review and update the information you entered when you joined.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Profile updated.",
    email_readonly: "Email cannot be changed here.\nContact Study Support if you need to update it.",
    password_title: "Password",
    password_hint: "You are still using the access code as your password. Choose a new one when you are ready.",
    password_current: "Current password",
    password_new: "New password",
    password_confirm: "Confirm new password",
    password_rules: "Use at least 8 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.",
    password_save: "Change password",
    password_saving: "Changing…",
    password_saved: "Password updated. Next time, sign in with the new password.",
    password_mismatch: "The new passwords do not match.",
    password_error: "Could not change your password. Please try again.",
    error_generic: "Could not save your profile. Please try again."
  },
  report: {
    action: "Report",
    reported: "Reported",
    prompt: "Why are you flagging this message?",
    placeholder: "Short explanation for the study team…",
    submit: "Submit report",
    sending: "Sending…",
    cancel: "Cancel",
    needExplanation: "Please include a short explanation.",
    submitted: "Thanks. The study team will review this. Your match is still active.",
    error: "Could not send the report. Please try again."
  },
  assessments: {
    title: "Assessments",
    subtitle: "Complete the 8-week follow-up when it is scheduled.",
    empty: "You do not have a questionnaire yet. The 8-week follow-up appears after you and your Simpatico Match start a conversation.",
    dueBanner: "You have {count} assessment(s) due.",
    dueModalBody: "Please complete your study questionnaires when you can. You can open them now or continue and come back from Assessments in the menu.",
    open: "Open assessments",
    dueLater: "Not now",
    due: "Due",
    overdue: "Overdue",
    upcoming: "Upcoming",
    notYetAvailable: "This 8-week follow-up is not available yet.",
    complete: "Complete",
    held: "Held",
    pendingContent: "This questionnaire will be available once the study team loads the official items.",
    scalePending: "This questionnaire is assigned, but the response scale is not confirmed yet. The study team will enable it once the source document is corrected.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    submit: "Submit",
    submitting: "Submitting…",
    submitted: "Thank you. Your responses were saved.",
    error: "Could not submit this assessment. Please try again.",
    back: "Back to list"
  }
};

export default en;
