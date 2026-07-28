require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI && !MONGODB_URI.includes('your_actual_mongodb')) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch(err => console.error('MongoDB Connection Error:', err.message));
}

// Media Schema & Model
const mediaSchema = new mongoose.Schema({
  title: String,
  type: { type: String, default: 'movie' }, // 'movie' or 'tv'
  tmdbId: String,
  posterUrl: String,
  overview: String,
  gofileUrl: String,
  genre: String,
  createdAt: { type: Date, default: Date.now }
});

const Media = mongoose.models.Media || mongoose.model('Media', mediaSchema);

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'erivox_secret_key_99',
  resave: false,
  saveUninitialized: false
}));

// Admin Protection Middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/login');
}

// Pass session data (isAdmin) to all views automatically
app.use((req, res, next) => {
  res.locals.isAdmin = !!(req.session && req.session.isAdmin);
  next();
});

// -------------------------------------------------------------
// PUBLIC NAVIGATION ROUTES
// -------------------------------------------------------------

// Home Route
app.get('/', async (req, res) => {
  try {
    let mediaList = [];
    if (mongoose.connection.readyState === 1) {
      mediaList = await Media.find().sort({ createdAt: -1 });
    }
    res.render('index', { mediaList });
  } catch (err) {
    res.render('index', { mediaList: [] });
  }
});

// Movies Page Route
app.get('/movies', async (req, res) => {
  try {
    let movies = [];
    if (mongoose.connection.readyState === 1) {
      movies = await Media.find({ type: 'movie' }).sort({ createdAt: -1 });
    }
    res.render('movie', { movies });
  } catch (err) {
    res.render('movie', { movies: [] });
  }
});

// TV Shows Page Route
app.get('/tvshows', async (req, res) => {
  try {
    let tvshows = [];
    if (mongoose.connection.readyState === 1) {
      tvshows = await Media.find({ type: 'tv' }).sort({ createdAt: -1 });
    }
    res.render('tvshows', { tvshows });
  } catch (err) {
    res.render('tvshows', { tvshows: [] });
  }
});

// Login Page GET
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Login POST
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.send('<p style="color:red;background:#0b0b0b;padding:20px;font-family:sans-serif;">Invalid password. <a href="/login" style="color:white;">Try again</a></p>');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// -------------------------------------------------------------
// ADMIN, SAVE, & DELETE ROUTES
// -------------------------------------------------------------

// Admin Dashboard
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin');
});

// Save Content
app.post('/admin/add', requireAdmin, async (req, res) => {
  const { title, type, tmdbId, posterUrl, overview, gofileUrl, genre } = req.body;

  try {
    if (mongoose.connection.readyState === 1) {
      const newMedia = new Media({
        title,
        type: type || 'movie',
        tmdbId,
        posterUrl,
        overview,
        gofileUrl,
        genre
      });
      await newMedia.save();
      console.log(`[ERIVOX] Published ${type}: ${title}`);
    }
  } catch (err) {
    console.error('Save Error:', err.message);
  }

  res.redirect('/');
});

// Delete Content (Admin Only)
app.post('/admin/delete/:id', requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Media.findByIdAndDelete(req.params.id);
      console.log(`[ERIVOX] Deleted media ID: ${req.params.id}`);
    }
  } catch (err) {
    console.error('Delete Error:', err.message);
  }
  res.redirect('back');
});

// TMDB Auto-Fetch
app.get('/admin/autofetch', requireAdmin, async (req, res) => {
  const { title, type } = req.query;

  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'TMDB_API_KEY missing' });

    const mediaType = type === 'tv' ? 'tv' : 'movie';
    const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl);
    const results = searchRes.data.results;

    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No media found on TMDB' });
    }

    const tmdbId = results[0].id;
    const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`;
    const detailsRes = await axios.get(detailsUrl);
    const media = detailsRes.data;

    return res.json({
      tmdbId: media.id,
      title: media.title || media.name,
      overview: media.overview || '',
      genres: media.genres ? media.genres.map(g => g.name).join(', ') : '',
      posterPath: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : ''
    });

  } catch (error) {
    return res.status(500).json({ error: 'TMDB Fetch failed' });
  }
});

app.listen(PORT, () => console.log(`ERIVOX running on port ${PORT}`));