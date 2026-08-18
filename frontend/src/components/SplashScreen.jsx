import React, { useState, useEffect } from 'react';

const SplashScreen = ({ onComplete }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Show splash for 2.5 seconds, then trigger fade out
    const timer1 = setTimeout(() => {
      setIsFadingOut(true);
    }, 2500);

    // Wait for the fade out transition (0.5s) to complete
    const timer2 = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="logo-container">
          <img src="/logo.png" alt="App Logo" className="splash-logo" />
        </div>
        <h1 className="splash-title">App is launching...</h1>
        <p className="splash-punchline">Predict. Optimize. Outperform.</p>
        <div className="loading-bar-container">
          <div className="loading-bar"></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
