import React, { useState } from 'react';
import axios from 'axios';

function LoginPage({ setToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const handleRegister = async () => {
    try {
      const response = await axios.post('http://localhost:5000/register', {
        email,
        password,
      });
      alert(response.data.message);
      setShowOtpInput(true);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const response = await axios.post('http://localhost:5000/verify-otp', {
        email,
        otp,
      });
      alert(response.data.message);
      setShowOtpInput(false);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:5000/login', {
        email,
        password,
      });
      setToken(response.data.token);
      alert('Login successful');
    } catch (error) {
      alert('Invalid email or password');
    }
  };

  const handleForgotPassword = async () => {
    try {
      const response = await axios.post('http://localhost:5000/forgot-password', {
        email,
      });
      alert(response.data.message);
      setShowResetPassword(true);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const handleResetPassword = async () => {
    try {
      const response = await axios.post('http://localhost:5000/reset-password', {
        email,
        otp,
        newPassword,
      });
      alert(response.data.message);
      setShowResetPassword(false);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  return (
    <>
      <div>
        <h2>Register/Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleRegister}>Register</button>
        {showOtpInput && (
          <>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button onClick={handleVerifyOtp}>Verify OTP</button>
          </>
        )}
        <button onClick={handleLogin}>Login</button>
        <button onClick={handleForgotPassword}>Forgot Password</button>
        {showResetPassword && (
          <>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <input
              type="password"
              placeholder="Enter New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button onClick={handleResetPassword}>Reset Password</button>
          </>
        )}
      </div>
    </>
  );
}

export default LoginPage;
