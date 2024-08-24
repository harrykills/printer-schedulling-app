import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import LoginPage from './components/Login_page';

function App() {
  const [token, setToken] = useState('');
  const [documents, setDocuments] = useState([]);
  const [pages, setPages] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState(null);

  useEffect(() => {
    if (token) {
      fetchJobs();
      checkAdminStatus();
    }
  }, [token]);

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
      await axios.post('http://localhost:5000/jobs', formData, {
        headers: {
          'Authorization': token,
          'Content-Type': 'multipart/form-data',
        },
      });
      alert('Files uploaded successfully');
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/jobs', {
        headers: { Authorization: token },
      });
      setJobs(response.data);
    } catch (error) {
      alert('Failed to fetch jobs');
    }
  };

  const checkAdminStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5000/admin/check', {
        headers: { Authorization: token },
      });
      setIsAdmin(response.data.isAdmin);
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  };

  const searchUserByEmail = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/admin/users?email=${searchEmail}`,
        {
          headers: { Authorization: token },
        }
      );
      setSearchedUser(response.data);
    } catch (error) {
      console.error('Error searching user:', error);
    }
  };

  const updateJobStatus = async (id, status) => {
    try {
      await axios.patch(
        `http://localhost:5000/admin/jobs/${id}/status`,
        { status },
        {
          headers: { Authorization: token },
        }
      );
      fetchJobs(); // Refresh the jobs list
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  };

  const handleLogout = () => {
    setToken('');
    alert('Logged out successfully');
  };

  return (
    <div className="App">
      <h1>Printer Scheduling App</h1>
      {!token && <LoginPage setToken={setToken} />}
      {token && (
        <>
          <button onClick={handleLogout}>Logout</button> {/* Logout Button */}
          <div>
            <h2>Upload Documents</h2>
            <input type="file" multiple onChange={handleFileChange} />
            {Array.from(documents).map((doc, index) => (
              <div key={index}>
                <label>{doc.name}</label>
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
                  <p>Price: ${job.price}</p>
                  <p>Documents:</p>
                  <ul>
                    {job.documents.map((doc, index) => (
                      <li key={index}>
                        {doc.filename} - {doc.pages} pages
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
          {isAdmin && (
            <div>
              <h2>Admin Dashboard</h2>
              <div>
                <h3>All Jobs</h3>
                <ul>
                  {jobs.map((job) => (
                    <li key={job._id}>
                      <p>Job ID: {job._id}</p>
                      <p>Status: {job.status}</p>
                      <p>Price: ${job.price}</p>
                      <p>Documents:</p>
                      <ul>
                        {job.documents.map((doc, index) => (
                          <li key={index}>
                            {doc.filename} - {doc.pages} pages
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => updateJobStatus(job._id, 'Completed')}
                      >
                        Mark as Completed
                      </button>
                      <button
                        onClick={() => updateJobStatus(job._id, 'Pending')}
                      >
                        Mark as Pending
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Search User by Email</h3>
                <input
                  type="email"
                  placeholder="Enter email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
                <button onClick={searchUserByEmail}>Search</button>
                {searchedUser && (
                  <div>
                    <p>User ID: {searchedUser._id}</p>
                    <p>Email: {searchedUser.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
