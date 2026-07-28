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
if (MONGODB_URI && MONGODB_URI !== 'your_actual_mongodb_connection_string_here') {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch(err => console.error('MongoDB Connection Error:', err.message));
} else {
  console.log('MongoDB URI missing or using default placeholder. Media will not be saved permanently until set.');
}

// Define Media Schema & Model
const mediaSchema = new mongoose.Schema({
  title: String,
  tmdbId: String,
  posterUrl: String,
  overview: String,
  gofileUrl: String,
  genre: String,
  createdAt: { type: Date, default: Date.now }
});

const Media = mongoose.models.Media || mongoose.model('Media', mediaSchema);

// View Engine Setup
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

// Home - Fetches all saved media from MongoDB and displays it
app.get('/', async (req, res) => {
  try {
    let mediaList = [];
    if (mongoose.connection.readyState === 1) {
      mediaList = await Media.find().sort({ createdAt: -1 });
    }
    res.render('index', { mediaList });
  } catch (err) {
    console.error('Render Error (index.ejs):', err.message);
    res.render('index', { mediaList: [] });
  }
});

// Movies Page
app.get('/movies', async (req, res) => {
  try {
    let movies = [];
    if (mongoose.connection.readyState === 1) {
      movies = await Media.find().sort({ createdAt: -1 });
    }
    res.render('movie', { movies });
  } catch (err) {
    res.redirect('/');
  }
});

// TV Shows Page
app.get('/tvshows', async (req, res) => {
  try {
    let tvshows = [];
    if (mongoose.connection.readyState === 1) {
      tvshows = await Media.find().sort({ createdAt: -1 });
    }
    res.render('tvshows', { tvshows });
  } catch (err) {
    res.redirect('/');
  }
});

// Login Page GET
app.get('/login', (req, res) => {
  res.render('login', { error: null }, (err, html) => {
    if (err) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>ERIVOX - Login</title>
          <style>
            body { background: #0b0b0b; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .login-card { background: #181818; padding: 40px; border-radius: 8px; border: 1px solid #282828; width: 320px; }
            h2 { margin-bottom: 20px; text-align: center; }
            h2 span { color: #e50914; }
            input { width: 100%; padding: 12px; margin-bottom: 20px; background: #222; border: 1px solid #333; color: white; border-radius: 4px; box-sizing: border-box; }
            button { width: 100%; padding: 12px; background: #e50914; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="login-card">
            <h2>ERI<span>VOX</span> Admin</h2>
            <form action="/login" method="POST">
              <input type="password" name="password" placeholder="Admin Password" required>
              <button type="submit">Access Dashboard</button>
            </form>
          </div>
        </body>
        </html>
      `);
    }
    res.send(html);
  });
});

// Login Form POST
app.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (password && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }

  res.send('<p style="color: red; background: #0b0b0b; font-family: sans-serif; padding: 20px;">Invalid password. <a href="/login" style="color: white;">Try again</a></p>');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// -------------------------------------------------------------
// PROTECTED ADMIN & AUTO-FETCH ROUTES
// -------------------------------------------------------------

// Admin Dashboard GET
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin');
});

// Save Content POST (Saves directly to MongoDB)
app.post('/admin/add', requireAdmin, async (req, res) => {
  const { title, tmdbId, posterUrl, overview, gofileUrl, genre } = req.body;

  try {
    if (mongoose.connection.readyState === 1) {
      const newMedia = new Media({
        title,
        tmdbId,
        posterUrl,
        overview,
        gofileUrl,
        genre
      });
      await newMedia.save();
      console.log('Saved to database:', title);
    } else {
      console.log('MongoDB not connected. Logged entry:', { title, tmdbId, gofileUrl });
    }
  } catch (err) {
    console.error('Error saving media:', err.message);
  }

  res.redirect('/');
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

    const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    const searchRes = await axios.get(searchUrl);
    const results = searchRes.data.results;

    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No matching media found on TMDB' });
    }

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