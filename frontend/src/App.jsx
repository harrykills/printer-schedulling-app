import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; // Ensure this path matches your CSS file location

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [token, setToken] = useState('');
  const [documents, setDocuments] = useState([]);
  const [pages, setPages] = useState([]);
  const [jobs, setJobs] = useState([]);

  const handleRegister = async () => {
    try {
      const response = await axios.post('http://localhost:5000/register', { email, password });
      alert(response.data.message);
      setShowOtpInput(true);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const response = await axios.post('http://localhost:5000/verify-otp', { email, otp });
      alert(response.data.message);
      setShowOtpInput(false);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:5000/login', { email, password });
      setToken(response.data.token);
      alert('Login successful');
    } catch (error) {
      alert('Invalid email or password');
    }
  };

  const handleForgotPassword = async () => {
    try {
      const response = await axios.post('http://localhost:5000/forgot-password', { email });
      alert(response.data.message);
      setShowResetPassword(true);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const handleResetPassword = async () => {
    try {
      const response = await axios.post('http://localhost:5000/reset-password', { email, otp, newPassword });
      alert(response.data.message);
      setShowResetPassword(false);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const handleFileChange = (event) => {
    setDocuments(event.target.files);
    setPages(Array(event.target.files.length).fill(''));
  };

  const handlePageChange = (index, event) => {
    const newPages = [...pages];
    newPages[index] = event.target.value;
    setPages(newPages);
  };

  const handleUpload = async () => {
    const formData = new FormData();
    for (let i = 0; i < documents.length; i++) {
      formData.append('documents', documents[i]);
      formData.append('pages', pages[i]);
    }
    try {
      const response = await axios.post('http://localhost:5000/jobs', formData, {
        headers: {
          'Authorization': token,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('Files uploaded successfully');
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/jobs', {
        headers: { 'Authorization': token }
      });
      setJobs(response.data);
    } catch (error) {
      alert('Failed to fetch jobs');
    }
  };

  useEffect(() => {
    if (token) {
      fetchJobs();
    }
  }, [token]);

  return (
    <div className="App">
      <h1>Printer Scheduling App</h1>
      {!token && (
        <>
          <div>
            <h2>Register</h2>
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
          </div>
          <div>
            <h2>Login</h2>
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
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button onClick={handleResetPassword}>Reset Password</button>
              </>
            )}
          </div>
        </>
      )}
      {token && (
        <>
          <div>
            <h2>Upload Documents</h2>
            <input type="file" multiple onChange={handleFileChange} />
            {Array.from(documents).map((doc, index) => (
              <div key={index}>
                <label>
                  {doc.name} 
                </label>
              </div>
            ))}
            <button onClick={handleUpload}>Upload</button>
          </div>
          <div>
            <h2>Your Jobs</h2>
            <button onClick={fetchJobs}>Refresh Jobs</button>
            <ul>
              {jobs.map((job) => (
                <li key={job._id}>
                  <p>Job ID: {job._id}</p>
                  <p>Status: {job.status}</p>
                  <p>Price: Rs. {job.price}</p>
                  <p>Documents:</p>
                  <ul>
                    {job.documents.map((doc, index) => (
                      <li key={index}>{doc.filename} - {doc.pages} pages</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
