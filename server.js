const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Middleware & Static Files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Connection Setup
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI && (MONGODB_URI.startsWith('mongodb://') || MONGODB_URI.startsWith('mongodb+srv://'))) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB database'))
    .catch(err => console.error('MongoDB Connection Error:', err));
} else {
  console.log('⚠️ Warning: MONGODB_URI is not set or invalid locally.');
}

// TMDB API Key from Environment
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

// --- ROUTES ---

// 1. Home Page Route
app.get('/', async (req, res) => {
  let movies = [];
  
  if (TMDB_API_KEY) {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`);
      if (response.ok) {
        const data = await response.json();
        movies = data.results || [];
      }
    } catch (e) {
      console.error('Error fetching trending movies:', e);
    }
  }

  res.render('index', { movies }, (err, html) => {
    if (err) {
      console.error('Error rendering index.ejs:', err);
      res.send('<h1>Welcome to ERIVOX</h1>');
    } else {
      res.send(html);
    }
  });
});

// 2. Movie Search Route
app.get('/search', async (req, res) => {
  const query = req.query.q;
  let movies = [];

  if (query && TMDB_API_KEY) {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        movies = data.results || [];
      }
    } catch (e) {
      console.error('Search fetch error:', e);
    }
  }

  res.render('index', { movies }, (err, html) => {
    if (err) {
      res.status(500).send('Error rendering search results.');
    } else {
      res.send(html);
    }
  });
});

// 3. Movie Details Route
app.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;

  try {
    let movieData = { 
      title: `Movie #${tmdbId}`, 
      overview: '', 
      release_date: '', 
      vote_average: 0 
    };

    if (TMDB_API_KEY) {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
      );
      if (response.ok) {
        movieData = await response.json();
      }
    }

    let customLink = null;
    try {
      if (typeof Link !== 'undefined') {
        customLink = await Link.findOne({ tmdbId: tmdbId });
      }
    } catch (dbErr) {
      console.log('Database lookup bypassed or model not found');
    }

    res.render('movie', {
      movie: {
        tmdbId: tmdbId,
        title: movieData.title || 'Unknown Title',
        overview: movieData.overview || 'No description available.',
        releaseYear: movieData.release_date ? movieData.release_date.split('-')[0] : 'N/A',
        voteAverage: movieData.vote_average ? Number(movieData.vote_average).toFixed(1) : 'N/A',
        // Embed Sources
        embedPrimary: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
        embedSecondary: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
        embedTertiary: `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}`,
        // Custom Gofile link from MongoDB
        customDownloadUrl: customLink ? customLink.downloadUrl : null,
        fileSize: customLink ? customLink.fileSize : null,
        quality: customLink ? customLink.quality : null
      }
    });

  } catch (error) {
    console.error('Error rendering movie page:', error);
    res.status(500).send('Server Error loading player page.');
  }
});

// --- SERVER STARTUP ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});