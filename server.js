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

// 1. Home Page
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
  res.render('index', { movies, title: 'Home' });
});

// 2. Movies Category Route
app.get('/movies', async (req, res) => {
  let movies = [];
  if (TMDB_API_KEY) {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`);
      if (response.ok) {
        const data = await response.json();
        movies = data.results || [];
      }
    } catch (e) {
      console.error(e);
    }
  }
  res.render('index', { movies, title: 'Popular Movies' });
});

// 3. TV Shows Category Route
app.get('/tv', async (req, res) => {
  let movies = [];
  if (TMDB_API_KEY) {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}`);
      if (response.ok) {
        const data = await response.json();
        movies = (data.results || []).map(tv => ({
          ...tv,
          title: tv.name,
          release_date: tv.first_air_date
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }
  res.render('index', { movies, title: 'Popular TV Shows' });
});

// 4. Genre Route
app.get('/genre/:genreId', async (req, res) => {
  const { genreId } = req.params;
  let movies = [];
  if (TMDB_API_KEY) {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}`);
      if (response.ok) {
        const data = await response.json();
        movies = data.results || [];
      }
    } catch (e) {
      console.error(e);
    }
  }
  res.render('index', { movies, title: 'Genre Results' });
});

// 5. Search Route (Fixes 'Cannot GET /search')
app.get('/search', async (req, res) => {
  const query = req.query.q;
  let movies = [];

  if (query && TMDB_API_KEY) {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        movies = (data.results || []).map(item => ({
          ...item,
          title: item.title || item.name,
          release_date: item.release_date || item.first_air_date
        }));
      }
    } catch (e) {
      console.error('Search fetch error:', e);
    }
  }

  res.render('index', { movies, title: `Search: ${query}` });
});

// 6. Movie Download Details
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