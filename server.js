const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'erivox_secret_key',
  resave: false,
  saveUninitialized: false
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/erivox')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Schema & Model
const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['movie', 'tv'], required: true },
  genre: String,
  posterUrl: String,
  gofileUrl: { type: String, required: true },
  subtitleUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const Media = mongoose.model('Media', mediaSchema);

// Admin Auth Middleware
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/admin/login');
};

// --- PUBLIC ROUTES ---

// 1. Homepage (With Search & Genre Filter)
app.get('/', async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    let filter = {};
    
    if (searchQuery) {
      filter = {
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { genre: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    const mediaList = await Media.find(filter).sort({ createdAt: -1 });
    res.render('index', { 
      mediaList, 
      searchQuery,
      isAdmin: req.session ? req.session.isAdmin : false 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 2. Movies Page
app.get('/movies', async (req, res) => {
  try {
    const mediaList = await Media.find({ type: 'movie' }).sort({ createdAt: -1 });
    res.render('index', { mediaList, searchQuery: '', isAdmin: req.session ? req.session.isAdmin : false });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// 3. TV Shows Page
app.get('/tvshows', async (req, res) => {
  try {
    const mediaList = await Media.find({ type: 'tv' }).sort({ createdAt: -1 });
    res.render('index', { mediaList, searchQuery: '', isAdmin: req.session ? req.session.isAdmin : false });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// --- ADMIN ROUTES ---

// Admin Dashboard / Management Page
app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const mediaList = await Media.find().sort({ createdAt: -1 });
    res.render('admin', { mediaList });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Admin Login Page (GET)
app.get('/admin/login', (req, res) => {
  res.render('login', { error: null });
});

// Admin Login Action (POST)
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid password. Access denied.' });
});

// Admin Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Add New Media Entry (POST)
app.post('/admin/add', requireAdmin, async (req, res) => {
  try {
    const { title, type, genre, posterUrl, gofileUrl, subtitleUrl } = req.body;
    
    await Media.create({
      title,
      type,
      genre,
      posterUrl,
      gofileUrl,
      subtitleUrl
    });

    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding content');
  }
});

// Delete Media Entry (POST)
app.post('/admin/delete/:id', requireAdmin, async (req, res) => {
  try {
    await Media.findByIdAndDelete(req.params.id);
    res.redirect('back');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting content');
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});