import React from "react";
import en from "../../translations/en";

const StudySupportMessage = () => {
  const t = en;

  return (
    <div className="study-support-message">
      <p style={{ margin: "0" }}>
        {t.support.contact_message}
      </p>
    </div>
  );
};

export default StudySupportMessage;
