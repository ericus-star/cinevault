require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

// Home Route
app.get('/', (req, res) => {
  res.render('index');
});

// Movies Route
app.get('/movies', (req, res) => {
  res.render('movie');
});

// Admin Route
app.get('/admin', (req, res) => {
  res.render('admin');
});

// Login Route
app.get('/login', (req, res) => {
  res.render('login');
});

// -------------------------------------------------------------
// TMDB AUTO-FETCH API ROUTE
// -------------------------------------------------------------
app.get('/admin/autofetch', async (req, res) => {
  const { title, type } = req.query;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const apiKey = process.env.TMDB_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'TMDB_API_KEY is missing from environment variables' });
    }

    const mediaType = type === 'tv' ? 'tv' : 'movie';

    // 1. Search TMDB for matching titles
    const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl);
    const results = searchRes.data.results;

    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No matching media found on TMDB' });
    }

    // 2. Take the first match
    const topResult = results[0];
    const tmdbId = topResult.id;

    // 3. Get full details using TMDB ID
    const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`;
    const detailsRes = await axios.get(detailsUrl);
    const media = detailsRes.data;

    // 4. Return formatted data back to admin panel
    return res.json({
      tmdbId: media.id,
      title: media.title || media.name,
      overview: media.overview || '',
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