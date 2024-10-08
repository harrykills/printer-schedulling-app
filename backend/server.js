require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { execFile } = require('child_process');
const sharp = require('sharp');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY;
const ADMIN_EMAILS = process.env.ADMIN_EMAILS.split(',');

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/printerScheduling', { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  otp: { type: String, required: false }
});

const User = mongoose.model('User', userSchema);

const jobSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  jobNumber: { type: Number, required: true, unique: true },
  documents: [{ filename: String, pages: Number }],
  price: Number,
  status: { type: String, default: 'Pending' }
});

const Job = mongoose.model('Job', jobSchema);

// Track the highest job number globally
let globalJobNumber = 0;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads', req.userId.toString());
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.userId = user.email;
    req.isAdmin = ADMIN_EMAILS.includes(user.email);
    next();
  });
};

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendOTP = async (email, otp) => {
  await transporter.sendMail({
    from: 'aitprintshop1@gmail.com',
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`
  });
};

const countPages = async (filePath, mimetype) => {
  if (mimetype === 'application/pdf') {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    if (pageCount === 0) {
      throw new Error('The document has no pages');
    }
    return pageCount;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return new Promise((resolve, reject) => {
      execFile('python', [path.join(__dirname, 'count_pages_win.py'), filePath], (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        const pageCount = parseInt(stdout, 10);
        if (pageCount === 0) {
          return reject(new Error('The document has no pages'));
        }
        resolve(pageCount);
      });
    });
  } else if (mimetype.startsWith('image/')) {
    return 1;
  } else {
    throw new Error('Unsupported file type');
  }
};

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await sendOTP(email, otp);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, otp });
    await user.save();
    res.status(201).json({ message: 'OTP sent to email. Please verify the OTP to complete registration.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (user && user.otp === otp) {
      user.otp = undefined;
      await user.save();
      res.json({ message: 'Registration successful. You can now log in.' });
    } else {
      res.status(400).json({ error: 'Invalid OTP' });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    if (!user.otp) {
      if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        return res.json({ token });
      } else {
        return res.status(400).json({ error: 'Invalid email or password' });
      }
    } else {
      return res.status(400).json({ error: 'Please verify your OTP first' });
    }
  } else {
    res.status(400).json({ error: 'Invalid email or password' });
  }
});

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await sendOTP(email, otp);
    user.otp = otp;
    await user.save();
    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (user && user.otp === otp) {
      user.password = await bcrypt.hash(newPassword, 10);
      user.otp = undefined;
      await user.save();
      res.json({ message: 'Password reset successful' });
    } else {
      res.status(400).json({ error: 'Invalid OTP' });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/jobs', authenticateToken, upload.array('documents'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please select a file' });
    }
    
    // Increment the global job number
    globalJobNumber += 1;
    
    const documents = await Promise.all(req.files.map(async (file) => {
      const pages = await countPages(file.path, file.mimetype);
      return { filename: file.filename, pages };
    }));
    
    const totalPages = documents.reduce((sum, doc) => sum + doc.pages, 0);
    const price = totalPages * 2;
    
    const job = new Job({
      userId: req.userId,
      jobNumber: globalJobNumber,
      documents,
      price
    });
    
    await job.save();
    
    // Create a folder for the job
    const uploadPath = path.join(__dirname, 'uploads', req.userId.toString(), `Job no.${globalJobNumber}`);
    fs.mkdirSync(uploadPath, { recursive: true });
    
    // Move files to the correct folder
    req.files.forEach(file => {
      const oldPath = file.path;
      const newPath = path.join(uploadPath, file.filename);
      fs.renameSync(oldPath, newPath);
    });
    
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.userId });
    res.json(jobs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/admin/check', authenticateToken, (req, res) => {
  res.json({ isAdmin: req.isAdmin });
});

app.get('/admin/jobs', authenticateToken, async (req, res) => {
  if (!req.isAdmin) {
    return res.sendStatus(403);
  }
  try {
    const jobs = await Job.find();
    res.json(jobs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/admin/jobs/:id/status', authenticateToken, async (req, res) => {
  if (!req.isAdmin) {
    return res.sendStatus(403);
  }
  try {
    const { id } = req.params;
    const { status } = req.body;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    job.status = status;
    await job.save();
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/admin/users', authenticateToken, async (req, res) => {
  if (!req.isAdmin) {
    return res.sendStatus(403);
  }
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
