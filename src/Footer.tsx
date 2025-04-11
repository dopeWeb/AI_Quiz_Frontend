import React from 'react';
import { useLocation } from 'react-router-dom';
import './Footer.css'; // Make sure to import your CSS
import myImage from './img/2017050.jpg';

const Footer: React.FC = () => {
  const location = useLocation();

  // If the current pathname indicates QuizDisplay should be hidden, return null
  if (location.pathname.startsWith("/quiz/take")) {
    return null;
  }

  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* Left Columns */}
        <div className="footer-section">
          {/* You can add additional content here if needed */}
        </div>
        <div className="footer-section">
          <h4>COOL</h4>
          <ul>
            <li>
              <a href="https://github.com/dopeWeb">My Github</a>
            </li>
          </ul>
        </div>

        {/* Right Column / Logo */}
        <div className="footer-section logo-section">
          <img src={myImage} alt="c" />
        </div>
      </div>

      <hr />

      <div className="footer-bottom">
        <p>© 2025 ME</p>
        <p>All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
