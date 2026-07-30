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
  res.redirect('/login');
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

// --- API ROUTES FOR TMDB AUTO-FETCH ---

app.get('/api/tmdb', requireAdmin, async (req, res) => {
  try {
    const { title, type } = req.query;
    const apiKey = process.env.TMDB_API_KEY;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Fallback if no TMDB Key is set: return basic search object
    if (!apiKey) {
      return res.json({
        title: title,
        genre: 'Action, Drama',
        posterUrl: 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title)
      });
    }

    const mediaType = type === 'tv' ? 'tv' : 'movie';
    const tmdbUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    
    const response = await fetch(tmdbUrl);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      const posterPath = match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : '';
      const displayTitle = match.title || match.name || title;

      return res.json({
        title: displayTitle,
        genre: match.genre_ids ? 'Action' : '', // Simplified genre tag
        posterUrl: posterPath
      });
    } else {
      return res.status(404).json({ error: 'No results found on TMDB' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch TMDB data' });
  }
});

// --- ADMIN & LOGIN ROUTES ---

// Admin Dashboard / Management Page
app.get(['/admin', '/dashboard'], requireAdmin, async (req, res) => {
  try {
    const mediaList = await Media.find().sort({ createdAt: -1 });
    res.render('admin', { mediaList });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Login Page (GET)
app.get(['/login', '/admin/login'], (req, res) => {
  res.render('login', { error: null });
});

// Login Action (POST)
app.post(['/login', '/admin/login'], (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid password. Access denied.' });
});

// Logout
app.get(['/logout', '/admin/logout'], (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Add New Media Entry (POST)
app.post(['/add', '/admin/add'], requireAdmin, async (req, res) => {
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
app.post(['/delete/:id', '/admin/delete/:id'], requireAdmin, async (req, res) => {
  try {
    await Media.findByIdAndDelete(req.params.id);
    const backUrl = req.get('Referrer') || '/';
    res.redirect(backUrl);
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