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

// Home
app.get('/', (req, res) => {
  res.render('index', (err, html) => {
    if (err) {
      console.error('Render Error (index.ejs):', err.message);
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>ERIVOX - Stream & Download</title>
          <style>
            body { background: #0b0b0b; color: white; font-family: sans-serif; text-align: center; padding-top: 100px; }
            h1 { font-size: 48px; letter-spacing: 2px; }
            h1 span { color: #e50914; }
            a { color: #e50914; font-weight: bold; text-decoration: none; font-size: 18px; }
          </style>
        </head>
        <body>
          <h1>ERI<span>VOX</span></h1>
          <p style="margin: 20px 0; color: #aaa;">Welcome to ERIVOX. Movies and TV shows platform.</p>
          <p><a href="/admin">Go to Admin Panel</a> | <a href="/login">Login</a></p>
        </body>
        </html>
      `);
    }
    res.send(html);
  });
});

// Movies Page
app.get('/movies', (req, res) => {
  res.render('movie', (err, html) => {
    if (err) return res.redirect('/');
    res.send(html);
  });
});

// TV Shows Page
app.get('/tvshows', (req, res) => {
  res.render('tvshows', (err, html) => {
    if (err) return res.redirect('/');
    res.send(html);
  });
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
  res.render('admin', (err, html) => {
    if (err) {
      console.error('Render Error (admin.ejs):', err.message);
      return res.status(500).send(`<h2>Error loading admin template:</h2><p>${err.message}</p>`);
    }
    res.send(html);
  });
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