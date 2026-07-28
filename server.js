require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'cinevault_secret_key_99',
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

// -------------------------------------------------------------
// PUBLIC NAVIGATION ROUTES
// -------------------------------------------------------------

// Home
app.get('/', (req, res) => {
  res.render('index');
});

// Movies Page
app.get('/movies', (req, res) => {
  res.render('movie');
});

// TV Shows Page
app.get('/tvshows', (req, res) => {
  res.render('tvshows');
});

// Genres Page
app.get('/genres', (req, res) => {
  res.render('genres');
});

// Login Page GET
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Login Form POST
app.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (password && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }

  res.render('login', { error: 'Invalid password. Access denied.' });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// -------------------------------------------------------------
// ADMIN & AUTO-FETCH ROUTES
// -------------------------------------------------------------

// Admin Dashboard GET
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin');
});

// Save Content POST
app.post('/admin/add', requireAdmin, (req, res) => {
  const { title, tmdbId, posterUrl, overview, gofileUrl, genre } = req.body;

  console.log('--- NEW CONTENT ADDED ---');
  console.log('Title:', title);
  console.log('TMDB ID:', tmdbId);
  console.log('Genre:', genre);
  console.log('Poster:', posterUrl);
  console.log('Overview:', overview);
  console.log('Gofile Link:', gofileUrl);

  res.redirect('/admin');
});

// TMDB Auto-Fetch Endpoint
app.get('/admin/autofetch', requireAdmin, async (req, res) => {
  const { title, type } = req.query;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const apiKey = process.env.TMDB_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'TMDB_API_KEY is missing in Render environment variables' });
    }

    const mediaType = type === 'tv' ? 'tv' : 'movie';

    // 1. Search TMDB
    const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl);
    const results = searchRes.data.results;

    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No matching media found on TMDB' });
    }

    // 2. Fetch full details using first match ID
    const tmdbId = results[0].id;
    const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`;
    const detailsRes = await axios.get(detailsUrl);
    const media = detailsRes.data;

    const genreNames = media.genres ? media.genres.map(g => g.name).join(', ') : '';

    return res.json({
      tmdbId: media.id,
      title: media.title || media.name,
      overview: media.overview || '',
      genres: genreNames,
      posterPath: media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : '',
      releaseDate: media.release_date || media.first_air_date || '',
      rating: media.vote_average || 0
    });

  } catch (error) {
    console.error('TMDB Auto-Fetch Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch details from TMDB' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`ERIVOX server running on port ${PORT}`);
});