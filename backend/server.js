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

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = 'your_secret_key'; // Make sure to use a secure key in production

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/printerScheduling', { useNewUrlParser: true, useUnifiedTopology: true });

// Define User Schema and Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// Define Job Schema and Model
const jobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
    req.userId = user.id;
    next();
  });
};

// User registration route
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// User login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(400).json({ error: 'Invalid username or password' });
  }
});

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

// Route for uploading documents and creating a job
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

// Route for retrieving user's jobs
app.get('/jobs', authenticateToken, async (req, res) => {
  const jobs = await Job.find({ userId: req.userId });
  res.json(jobs);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
