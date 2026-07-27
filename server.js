const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI && (MONGODB_URI.startsWith('mongodb://') || MONGODB_URI.startsWith('mongodb+srv://'))) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB database'))
    .catch(err => console.error('MongoDB Connection Error:', err));
}

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

// Home Route
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
  res.render('index', { movies });
});

// Movie Details & Download Page
app.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;

  try {
    let movieData = { title: `Movie #${tmdbId}`, overview: '', release_date: '', vote_average: 0, poster_path: null };

    if (TMDB_API_KEY) {
      const response = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
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
      console.log('Database lookup bypassed');
    }

    res.render('movie', {
      movie: {
        tmdbId: tmdbId,
        title: movieData.title || 'Unknown Title',
        overview: movieData.overview || 'No description available.',
        releaseYear: movieData.release_date ? movieData.release_date.split('-')[0] : 'N/A',
        voteAverage: movieData.vote_average ? Number(movieData.vote_average).toFixed(1) : 'N/A',
        posterPath: movieData.poster_path,
        // Gofile Link saved in DB
        customDownloadUrl: customLink ? customLink.downloadUrl : null,
        fileSize: customLink ? customLink.fileSize : null,
        quality: customLink ? customLink.quality : null
      }
    });

  } catch (error) {
    console.error('Error loading movie page:', error);
    res.status(500).send('Server Error loading download page.');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));