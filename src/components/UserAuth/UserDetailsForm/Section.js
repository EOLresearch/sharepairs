import React, { useEffect, useState } from 'react';
// import { AiOutlineDown, AiOutlineUp } from 'react-icons/ai';
{/* <AiOutlineDown /> : <AiOutlineUp /> */}


function Section({ title, children, openIs }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (openIs) {
      setIsOpen(true);
    }
  }, [openIs]);

  return (
    <div className="reg-section">
      <div onClick={() => setIsOpen(!isOpen)} className='reg-section-header'>
      <h4 style={{cursor: 'pointer'}}>
        {title}
      </h4>
      {isOpen ? '▲' : '▼'}
      </div>
      {isOpen && children}
    </div>
  );
}

export default Section;
