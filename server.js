const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// Body Parser Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'erivox-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 Hours
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Setup & Link Model Schema
const MONGODB_URI = process.env.MONGODB_URI;

const linkSchema = new mongoose.Schema({
  tmdbId: { type: String, required: true, unique: true },
  title: { type: String },
  downloadUrl: { type: String, required: true },
  quality: { type: String, default: '1080p' },
  fileSize: { type: String, default: 'N/A' },
  createdAt: { type: Date, default: Date.now }
});

const Link = mongoose.models.Link || mongoose.model('Link', linkSchema);

if (MONGODB_URI && (MONGODB_URI.startsWith('mongodb://') || MONGODB_URI.startsWith('mongodb+srv://'))) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB database'))
    .catch(err => console.error('MongoDB Connection Error:', err));
}

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Auth Protection Middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/login');
};

// --- SEO & INDEXING ROUTES ---

// Dynamic Sitemap for Google Search Console
app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://erivox.onrender.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://erivox.onrender.com/movies</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://erivox.onrender.com/tv</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`.trim();
  res.send(sitemapXml);
});

// Serve Robots.txt directly
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\n\nSitemap: https://erivox.onrender.com/sitemap.xml");
});

// --- PUBLIC ROUTES ---

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
      console.error(e);
    }
  }
  res.render('index', { movies, title: 'Home' });
});

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
      console.error(e);
    }
  }
  res.render('index', { movies, title: `Search: ${query}` });
});

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

    let customLink = await Link.findOne({ tmdbId: tmdbId });

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
    res.status(500).send('Server Error loading download page.');
  }
});

// --- LOGIN & AUTH ROUTES ---

app.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Incorrect Password. Please try again.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// --- PROTECTED ADMIN ROUTES ---

app.get('/admin', requireAuth, async (req, res) => {
  try {
    const links = await Link.find().sort({ createdAt: -1 });
    res.render('admin', { links });
  } catch (err) {
    res.status(500).send('Database Error loading Admin Dashboard.');
  }
});

app.post('/admin/add-link', requireAuth, async (req, res) => {
  const { tmdbId, title, downloadUrl, quality, fileSize } = req.body;
  try {
    await Link.findOneAndUpdate(
      { tmdbId: tmdbId.trim() },
      { 
        tmdbId: tmdbId.trim(),
        title: title || 'Custom Movie',
        downloadUrl: downloadUrl.trim(),
        quality: quality || '1080p',
        fileSize: fileSize || 'N/A'
      },
      { upsert: true, new: true }
    );
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Failed to save download link.');
  }
});

app.post('/admin/delete-link/:id', requireAuth, async (req, res) => {
  try {
    await Link.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Failed to delete link.');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));