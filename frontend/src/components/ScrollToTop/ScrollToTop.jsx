import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import './ScrollToTop.css';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const getViewport = () => document.querySelector('.main-viewport');
    const toggleVisibility = () => {
      const vp = getViewport();
      const scrollY = vp ? vp.scrollTop : window.scrollY;
      if (scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    const vp = getViewport();
    if (vp) vp.addEventListener('scroll', toggleVisibility);
    window.addEventListener('scroll', toggleVisibility);

    return () => {
      if (vp) vp.removeEventListener('scroll', toggleVisibility);
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    const vp = document.querySelector('.main-viewport');
    if (vp) {
      vp.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!isVisible) return null;

  return (
    <button 
      onClick={scrollToTop} 
      className="scroll-to-top-btn"
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <ChevronUp size={24} />
    </button>
  );
}
