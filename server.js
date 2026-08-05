const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const app = express();

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security Middleware
app.use(helmet({ contentSecurityPolicy: false })); // Secures HTTP headers
app.use(mongoSanitize()); // Sanitizes user input to prevent NoSQL injection attacks

// Standard Middleware
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
const dbUri = process.env.DATABASE_URL || process.env.MONGODB_URI;
mongoose.connect(dbUri)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Media Schema (Supports Movies & TV Shows with Episodes/ZIP)
const mediaSchema = new mongoose.Schema({
  title: String,
  type: { type: String, default: 'movie' },
  genre: String,
  poster: String,
  videoUrl: String, // Full Movie or Season ZIP Link
  episodes: [
    {
      title: String,
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

// Home Page
app.get('/', async (req, res) => {
  try {
    const { search, type, genre } = req.query;
    let query = {};

    if (search) query.title = { $regex: String(search), $options: 'i' };
    if (type && type !== 'all') query.type = String(type);
    if (genre && genre !== 'all') query.genre = { $regex: String(genre), $options: 'i' };

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

// Single Media View Page (Details & Download Links)
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

// DMCA Page
app.get('/dmca', (req, res) => {
  res.render('dmca');
});

// Dynamic XML Sitemap for Google Search Console
app.get('/sitemap.xml', async (req, res) => {
  try {
    const movies = await Media.find();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://erivox.onrender.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://erivox.onrender.com/dmca</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

    movies.forEach(item => {
      xml += `
  <url>
    <loc>https://erivox.onrender.com/media/${item._id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap Error:', err);
    res.status(500).end();
  }
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

// TMDB Auto-Fetch Endpoint
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