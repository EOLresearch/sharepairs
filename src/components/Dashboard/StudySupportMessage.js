import React from "react";
import { useEffect } from "react";
import en from "../../translations/en";
import tr from "../../translations/tr";

const StudySupportMessage = ({ language }) => {
  const t = language === "tr" ? tr : en;

  return (
    <div className="study-support-message">
      <p style={{ margin: "0" }}>
        {t.support.contact_message}
      </p>
    </div>
  );
};

export default StudySupportMessage;
