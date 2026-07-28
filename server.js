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

// Schema & Model
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
    res.render('index', { mediaList }, (err, html) => {
      if (err) return res.status(500).send(`<h2>Error loading home view:</h2><p>${err.message}</p>`);
      res.send(html);
    });
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
    res.render('movie', { movies }, (err, html) => {
      if (err) {
        console.error('Render Error (movie.ejs):', err.message);
        // Safe fallback render if movie.ejs is missing
        return res.status(200).send(`
          <!DOCTYPE html><html><head><title>ERIVOX - Movies</title>
          <style>body{background:#0b0b0b;color:white;font-family:sans-serif;padding:40px;text-align:center;}
          a{color:#e50914;font-weight:bold;text-decoration:none;}</style></head>
          <body><h1>ERI<span style="color:#e50914">VOX</span> Movies</h1>
          <p>No movies template active yet or no movies published.</p><p><a href="/">Back Home</a></p></body></html>
        `);
      }
      res.send(html);
    });
  } catch (err) {
    res.redirect('/');
  }
});

// TV Shows Page Route
app.get('/tvshows', async (req, res) => {
  try {
    let tvshows = [];
    if (mongoose.connection.readyState === 1) {
      tvshows = await Media.find({ type: 'tv' }).sort({ createdAt: -1 });
    }
    res.render('tvshows', { tvshows }, (err, html) => {
      if (err) {
        return res.status(200).send(`
          <!DOCTYPE html><html><head><title>ERIVOX - TV Shows</title>
          <style>body{background:#0b0b0b;color:white;font-family:sans-serif;padding:40px;text-align:center;}
          a{color:#e50914;font-weight:bold;text-decoration:none;}</style></head>
          <body><h1>ERI<span style="color:#e50914">VOX</span> TV Shows</h1>
          <p><a href="/">Back Home</a></p></body></html>
        `);
      }
      res.send(html);
    });
  } catch (err) {
    res.redirect('/');
  }
});

// Login Page GET
app.get('/login', (req, res) => {
  res.render('login', { error: null }, (err, html) => {
    if (err) {
      return res.send(`
        <!DOCTYPE html><html><head><title>ERIVOX - Admin Login</title>
        <style>body{background:#0b0b0b;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
        .card{background:#181818;padding:30px;border-radius:8px;border:1px solid #282828;}
        input,button{width:100%;padding:10px;margin-top:10px;box-sizing:border-box;}
        button{background:#e50914;color:white;border:none;font-weight:bold;cursor:pointer;}</style></head>
        <body><div class="card"><h2>ERI<span style="color:#e50914">VOX</span> Admin</h2>
        <form action="/login" method="POST"><input type="password" name="password" placeholder="Password" required><button type="submit">Login</button></form></div></body></html>
      `);
    }
    res.send(html);
  });
});

// Login POST
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.send('<p style="color:red;background:#0b0b0b;padding:20px;">Invalid password. <a href="/login" style="color:white;">Try again</a></p>');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// -------------------------------------------------------------
// ADMIN & AUTO-FETCH ROUTES
// -------------------------------------------------------------

// Admin Dashboard
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin', (err, html) => {
    if (err) return res.status(500).send(`<h2>Error loading admin dashboard:</h2><p>${err.message}</p>`);
    res.send(html);
  });
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
    }
  } catch (err) {
    console.error('Save Error:', err.message);
  }

  res.redirect('/');
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