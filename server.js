const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'erivox-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Movie Schema
const movieSchema = new mongoose.Schema({
  title: String,
  genre: String,
  poster: String,
  videoUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const Movie = mongoose.model('Movie', movieSchema);

// Auth Middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/login');
}

// --- PUBLIC ROUTES ---

// Homepage
app.get('/', async (req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.render('index', { movies });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Single Movie Details Page
app.get('/movie/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).send('Movie not found');
    res.render('movie', { movie });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// --- AUTH ROUTES ---

// Login GET
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.get('/admin/login', (req, res) => {
  res.redirect('/login');
});

// Login POST
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Invalid Password' });
  }
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Invalid Password' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// --- ADMIN DASHBOARD & CRUD ROUTES ---

// Admin Dashboard
app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.render('admin', { movies });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Add Movie
app.post('/admin/add', requireAdmin, async (req, res) => {
  try {
    const { title, genre, poster, videoUrl } = req.body;
    await Movie.create({ title, genre, poster, videoUrl });
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding movie');
  }
});

// Delete Movie
app.post('/admin/delete/:id', requireAdmin, async (req, res) => {
  try {
    await Movie.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting movie');
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});