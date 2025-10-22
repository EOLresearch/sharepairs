import React, { useState, useRef, useEffect } from "react";

const HoverTooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const tooltipRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!visible || !tooltipRef.current || !wrapperRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const margin = 10; // Small margin to prevent sticking to the edge

    let left = "50%";
    let transform = "translateX(-50%)";

    // Adjust if overflowing left
    if (tooltipRect.left < margin) {
      left = `${margin}px`;
      transform = "none";
    }

    // Adjust if overflowing right
    if (tooltipRect.right > window.innerWidth - margin) {
      left = `calc(100% - ${tooltipRect.width + margin}px)`;
      transform = "none";
    }

    setTooltipStyle({ left, transform });
  }, [visible]);

  return (
    <>
      {/* This removes any layout interference */}
      <span
        ref={wrapperRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{ display: "contents" }} // Removes parent wrapper from affecting layout
      >
        {children}
      </span>
      {visible && (
        <div ref={tooltipRef} className="tooltip" style={tooltipStyle}>
          {text}
        </div>
      )}
    </>
  );
};

export default HoverTooltip;
