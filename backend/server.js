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
const SECRET_KEY = 'CrIsTaN@#12980'; 
const ADMIN_EMAILS = ['admin1@example.com', 'admin2@example.com']; 


app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/printerScheduling', { useNewUrlParser: true, useUnifiedTopology: true });

// Define User Schema and Model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  otp: { type: String, required: false }
});

const User = mongoose.model('User', userSchema);

// Define Job Schema and Model
const jobSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  documents: [{ filename: String, pages: Number }],
  price: Number,
  status: { type: String, default: 'Pending' }
});

const Job = mongoose.model('Job', jobSchema);

// Multer setup for file uploads
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

// Middleware for authenticating JWT tokens
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.userId = user.email;
    next();
  });
};

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'aitprintshop1@gmail.com',
    pass: 'ykvk hydd jrew psjl'
  }
});

// Helper function to send OTP
const sendOTP = async (email, otp) => {
  await transporter.sendMail({
    from: 'aitprintshop1@gmail.com',
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}`
  });
};

// Helper function to count pages
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
    return 1; // Flat rate for image files
  } else {
    throw new Error('Unsupported file type');
  }
};

// User registration route with OTP
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

// OTP verification route
app.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (user && user.otp === otp) {
      user.otp = undefined; // Clear OTP after verification
      await user.save();
      res.json({ message: 'Registration successful. You can now log in.' });
    } else {
      res.status(400).json({ error: 'Invalid OTP' });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// User login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    if (!user.otp) {
      if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user._id, email : user.email}, SECRET_KEY, { expiresIn: '1h' });
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

// Forgot password route
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

// Verify OTP and reset password route
app.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (user && user.otp === otp) {
      user.password = await bcrypt.hash(newPassword, 10);
      user.otp = undefined; // Clear OTP after resetting the password
      await user.save();
      res.json({ message: 'Password reset successful' });
    } else {
      res.status(400).json({ error: 'Invalid OTP' });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Document upload route
app.post('/jobs', authenticateToken, upload.array('documents'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please select a file' });
    }
    const documents = await Promise.all(req.files.map(async (file) => {
      const pages = await countPages(file.path, file.mimetype);
      return { filename: file.filename, pages };
    }));
    const totalPages = documents.reduce((sum, doc) => sum + doc.pages, 0);
    const price = totalPages * 2;
    const job = new Job({
      userId: req.userId,
      documents,
      price
    });
    await job.save();
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fetch user jobs route
app.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.userId });
    res.json(jobs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
