import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; // Import your custom CSS file
import printer from './assets/printer.png';

const App = () => {
  const [username_login, setUsername_login] = useState('');
  const [password_login, setPassword_login] = useState('');
  const [username_register, setUsername_register] = useState('');
  const [password_register, setPassword_register] = useState('');
  const [token, setToken] = useState('');
  const [documents, setDocuments] = useState([]);
  const [pages, setPages] = useState([]);
  const [jobs, setJobs] = useState([]);

  const handleRegister = async () => {
    try {
      const response = await axios.post('http://localhost:5000/register', { username: username_register, password: password_register });
      alert(response.data.message);
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:5000/login', { username: username_login, password: password_login });
      setToken(response.data.token);
      alert('Login successful');
    } catch (error) {
      alert('Invalid username or password');
    }
  };

  const handleFileChange = (event) => {
    setDocuments(event.target.files);
    setPages(Array(event.target.files.length).fill(''));
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
      <div className='photo'>
        <img src={printer} alt="" />
      </div>
      <div className="Heading">
      <h1>Printer Shop Scheduling App</h1>
      </div>
      {!token ? (
        <div className="auth-container">
          <div className="auth-form">
            <h2>Login</h2>
            <input
              type="text"
              placeholder="Username"
              value={username_login}
              onChange={(e) => setUsername_login(e.target.value)}
              className="auth-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password_login}
              onChange={(e) => setPassword_login(e.target.value)}
              className="auth-input"
            />
            <button onClick={handleLogin} className="auth-button">Login</button>
          </div>
          <div className="auth-form">
            <h2>Register</h2>
            <input
              type="text"
              placeholder="Username"
              value={username_register}
              onChange={(e) => setUsername_register(e.target.value)}
              className="auth-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password_register}
              onChange={(e) => setPassword_register(e.target.value)}
              className="auth-input"
            />
            <button onClick={handleRegister} className="auth-button">Register</button>
          </div>
        </div>
      ) : (
        <div className="main-container">
          <div className="upload-container">
            <h2>Upload Documents</h2>
            <input type="file" multiple onChange={handleFileChange} className="file-input" />
            {Array.from(documents).map((doc, index) => (
              <div key={index} className="file-info">
                <label>
                  {doc.name} 
                </label>
              </div>
            ))}
            <button onClick={handleUpload} className="upload-button">Upload</button>
          </div>
          <div className="jobs-container">
            <h2>Your Jobs</h2>
            <button onClick={fetchJobs} className="refresh-button">Refresh Jobs</button>
            <ul>
              {jobs.map((job) => (
                <li key={job._id} className="job-item">
                  <p>Job ID: {job._id}</p>
                  <p>Status: {job.status}</p>
                  <p>Price: ${job.price}</p>
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
        </div>
      )}
    </div>
  );
}

export default App;
