const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'erivox-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Movie & TV Show Schema (Supports both single link & episode arrays)
const mediaSchema = new mongoose.Schema({
  title: String,
  type: { type: String, default: 'movie' },
  genre: String,
  poster: String,
  videoUrl: String, // Main download / Full Season ZIP link
  episodes: [
    {
      title: String, // e.g. "Episode 1" or "S01E01"
      videoUrl: String
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const Media = mongoose.model('Media', mediaSchema);

// Auth Middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/login');
}

// --- PUBLIC ROUTES ---

app.get('/', async (req, res) => {
  try {
    const { search, type, genre } = req.query;
    let query = {};

    if (search) query.title = { $regex: search, $options: 'i' };
    if (type && type !== 'all') query.type = type;
    if (genre && genre !== 'all') query.genre = { $regex: genre, $options: 'i' };

    const movies = await Media.find(query).sort({ createdAt: -1 });
    res.render('index', { 
      movies, 
      activeSearch: search || '', 
      activeType: type || 'all', 
      activeGenre: genre || 'all' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Single Media View Page (Movies & TV Shows)
app.get('/media/:id', async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item) return res.status(404).send('Media not found');
    res.render('movie', { item });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// DMCA Route
app.get('/dmca', (req, res) => {
  res.render('dmca');
});

// --- AUTH ROUTES ---

app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/admin/login', (req, res) => res.redirect('/login'));

app.post('/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Invalid Password' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// --- ADMIN ROUTES ---

app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const movies = await Media.find().sort({ createdAt: -1 });
    res.render('admin', { movies });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// TMDB Fetch Endpoint
app.get('/admin/fetch-tmdb', requireAdmin, async (req, res) => {
  const { title, type } = req.query;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'TMDB_API_KEY missing' });

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    const response = await fetch(tmdbUrl);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      res.json({
        title: match.title || match.name,
        poster: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : ''
      });
    } else {
      res.status(404).json({ error: 'No matching titles found on TMDB.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'TMDB Fetch Error: ' + err.message });
  }
});

// Add New Media
app.post('/admin/add', requireAdmin, async (req, res) => {
  try {
    const { title, type, genre, poster, videoUrl } = req.body;
    await Media.create({ title, type: type || 'movie', genre, poster, videoUrl, episodes: [] });
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding item');
  }
});

// Add Single Episode to Existing Show
app.post('/admin/add-episode/:id', requireAdmin, async (req, res) => {
  try {
    const { episodeTitle, episodeUrl } = req.body;
    await Media.findByIdAndUpdate(req.params.id, {
      $push: { episodes: { title: episodeTitle, videoUrl: episodeUrl } }
    });
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding episode');
  }
});

// Delete Single Item
app.post('/admin/delete/:id', requireAdmin, async (req, res) => {
  try {
    await Media.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting item');
  }
});

// Delete All Media
app.post('/admin/delete-all', requireAdmin, async (req, res) => {
  try {
    await Media.deleteMany({});
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting all items');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));