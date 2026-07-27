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

// MongoDB Connection Setup (Safe handling for local & production)
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI && (MONGODB_URI.startsWith('mongodb://') || MONGODB_URI.startsWith('mongodb+srv://'))) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB database'))
    .catch(err => console.error('MongoDB Connection Error:', err));
} else {
  console.log('⚠️ Warning: MONGODB_URI is not set or invalid locally. Running in offline/bypass mode.');
}

// TMDB API Key from Environment
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

// --- ROUTES ---

// 1. Home Page Route
app.get('/', (req, res) => {
  res.render('index');
});

// 2. Movie Details & Dynamic Streaming / Download Route
app.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;

  try {
    let movieData = { 
      title: `Movie #${tmdbId}`, 
      overview: '', 
      release_date: '', 
      vote_average: 0 
    };

    // Fetch TMDB data if API Key is configured
    if (TMDB_API_KEY) {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
      );
      if (response.ok) {
        movieData = await response.json();
      }
    }

    // Safely check MongoDB for custom Gofile links if model exists
    let customLink = null;
    try {
      if (typeof Link !== 'undefined') {
        customLink = await Link.findOne({ tmdbId: tmdbId });
      }
    } catch (dbErr) {
      console.log('Database lookup bypassed or model not found');
    }

    // Render EJS with dynamic embed sources
    res.render('movie', {
      movie: {
        tmdbId: tmdbId,
        title: movieData.title || 'Unknown Title',
        overview: movieData.overview || 'No description available.',
        releaseYear: movieData.release_date ? movieData.release_date.split('-')[0] : 'N/A',
        voteAverage: movieData.vote_average ? Number(movieData.vote_average).toFixed(1) : 'N/A',
        // Reliable Embed Providers
        embedPrimary: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
        embedSecondary: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
        // Custom Gofile direct link from MongoDB (if added via admin panel)
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