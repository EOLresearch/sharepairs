const en = {
  welcome: {
    hello_user: "Hello, {{name}}",
    thank_you: "Thank you for joining Share Pairs.",
    intro_1: "This application is designed for you to create positive social interactions with others who have experienced a similar loss. We ask that you log in at least once a day to chat with your Share Pair.",
    intro_2: "Our goal is to help you find someone who can relate to your loss. We hope that you will find comfort in sharing your story and listening to the stories of others. We are here to help you through your grief journey.",
    left_panel: "On the left side, you will find your active conversations and contacts list. Each side can be collapsed or expanded.",
    center_panel: "In the center, you will find the main chat window.",
    right_panel: "On the right side, you will find information about your Share Pair and some prompts to help get the conversation started."
  },
  support: {
    contact_message:
      "If you have any issues with the application or chatting with your match, please reach out to Study Support via your Contacts pane."
  },
  auth: {
    login_title: "Login",
    email_placeholder: "Your Email Address",
    password_placeholder: "Your Password",
    login_button: "Login",
    logging_in: "Logging in...",
    forgot_password: "Forgot Password?",
    join_prompt: "Not a member? ",
    join_now: "Join now",
    error_unverified: "Please verify your email before logging in.",
    error_invalid_credentials: "Invalid email or password.",
    error_generic: "Login failed. Please try again."
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
      your_story: "Your Story"
    },
    labels: {
      email: "Email",
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
    buttons: {
      submit: "Submit",
      submitting: "Submitting...",
      back_to_login: "Back to Login",
      return_home: "Return to Home"
    },
    errors: {
      missing_email: "Missing email address.",
      missing_password: "Password is required.",
      password_mismatch: "Passwords do not match.",
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
      email_in_use: "This email is already in use.",
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
    story_title: "Your Share Pair's Story:",
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
    new_match: '🎉 You have been matched! View the contacts panel to see your new match.',
    request_accepted: '{name} has accepted the conversation. Open it now?',
    already_active: 'This conversation is already active.',
    not_accepted: "This conversation hasn't been accepted by both users yet.",
  },
  distress: {
    title: "Distress Thermometer",
    instructions: "Before you start or continue your conversation with your match, please click on the number that best describes your current level of distress.",
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
    unmatchedLine1: "We're still working to match you with someone who shares a similar experience.",
    unmatchedLine2: "Once you're matched, your Share Pair will appear in the Contacts panel and you can start a conversation.",
    noConversationTitle: "Select a conversation",
    noConversationLine: "Your messages will appear here.",
    loadMore: "Load More",
    noMessages: "No messages yet. Start the conversation!",
    inputPlaceholder: "Type a message",
    send: "Send"
  }







};

export default en;
