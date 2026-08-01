const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const r2Client = require('./config/r2'); // R2 helper configuration
require('dotenv').config();

const app = express();

// Security Headers
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');

// Rate Limiter for Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure Multer for In-Memory File Buffer Storage (Cloudflare Uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max limit
});

// Helper Function: Upload file buffer directly to Cloudflare R2 Bucket
async function uploadToR2(file) {
  if (!file) return null;

  const cleanFileName = file.originalname.replace(/\s+/g, '-');
  const fileKey = `${Date.now()}-${cleanFileName}`;

  const uploadParams = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await r2Client.send(new PutObjectCommand(uploadParams));
  return `${process.env.R2_PUBLIC_URL}/${fileKey}`;
}

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'erivox_super_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 2
  }
}));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/erivox')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Database Schema
const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['movie', 'tv'], required: true },
  genre: String,
  posterUrl: String,
  gofileUrl: { type: String, required: true },
  subtitleUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const Media = mongoose.model('Media', mediaSchema);

// Admin Authentication Middleware
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/login');
};

// ==========================================
// DYNAMIC SITEMAP ROUTE
// ==========================================
app.get('/sitemap.xml', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static Pages
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${baseUrl}/movies</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${baseUrl}/tvshows</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    xml += `  <url>\n    <loc>${baseUrl}/dmca</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.3</priority>\n  </url>\n`;

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap Generation Error:', err);
    res.status(500).end();
  }
});

// ==========================================
// PUBLIC ROUTES
// ==========================================
app.get('/', async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    let filter = {};
    
    if (searchQuery) {
      filter = {
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { genre: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    const mediaList = await Media.find(filter).sort({ createdAt: -1 });
    res.render('index', { 
      mediaList, 
      searchQuery,
      isAdmin: req.session ? req.session.isAdmin : false 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/movies', async (req, res) => {
  try {
    const mediaList = await Media.find({ type: 'movie' }).sort({ createdAt: -1 });
    res.render('index', { mediaList, searchQuery: '', isAdmin: req.session ? req.session.isAdmin : false });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.get('/tvshows', async (req, res) => {
  try {
    const mediaList = await Media.find({ type: 'tv' }).sort({ createdAt: -1 });
    res.render('index', { mediaList, searchQuery: '', isAdmin: req.session ? req.session.isAdmin : false });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.get('/dmca', (req, res) => {
  res.render('dmca');
});

// ==========================================
// TMDB API ROUTE
// ==========================================
app.get('/api/tmdb', requireAdmin, async (req, res) => {
  try {
    const { title, type } = req.query;
    const apiKey = process.env.TMDB_API_KEY;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    if (!apiKey) {
      return res.json({
        title: title,
        genre: 'Action, Drama',
        posterUrl: 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title)
      });
    }

    const mediaType = type === 'tv' ? 'tv' : 'movie';
    const tmdbUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    
    const response = await fetch(tmdbUrl);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      const posterPath = match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : '';
      const displayTitle = match.title || match.name || title;

      return res.json({
        title: displayTitle,
        genre: 'Action',
        posterUrl: posterPath
      });
    } else {
      return res.status(404).json({ error: 'No results found on TMDB' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch TMDB data' });
  }
});

// ==========================================
// ADMIN & AUTH ROUTES
// ==========================================
app.get(['/login', '/admin/login'], (req, res) => {
  res.render('login', { error: null });
});

app.post(['/login', '/admin/login'], loginLimiter, (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid password. Access denied.' });
});

app.get(['/admin', '/dashboard'], requireAdmin, async (req, res) => {
  try {
    const mediaList = await Media.find().sort({ createdAt: -1 });
    res.render('admin', { mediaList });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.get(['/logout', '/admin/logout'], (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Add Media Route with Cloudflare R2 Upload Support
app.post(
  ['/add', '/admin/add'], 
  requireAdmin, 
  upload.fields([{ name: 'posterFile', maxCount: 1 }, { name: 'mediaFile', maxCount: 1 }]), 
  async (req, res) => {
    try {
      let finalPosterUrl = req.body.posterUrl || '';
      let finalGofileUrl = req.body.gofileUrl ? req.body.gofileUrl.trim() : '';

      // Upload poster file to Cloudflare R2 if attached
      if (req.files && req.files.posterFile && req.files.posterFile[0]) {
        finalPosterUrl = await uploadToR2(req.files.posterFile[0]);
      }

      // Upload video/media file to Cloudflare R2 if attached
      if (req.files && req.files.mediaFile && req.files.mediaFile[0]) {
        finalGofileUrl = await uploadToR2(req.files.mediaFile[0]);
      }

      await Media.create({
        title: req.body.title,
        type: req.body.type,
        genre: req.body.genre,
        posterUrl: finalPosterUrl,
        subtitleUrl: req.body.subtitleUrl,
        gofileUrl: finalGofileUrl
      });

      res.redirect('/admin');
    } catch (err) {
      console.error('Add Content Error:', err);
      res.status(500).send('Error adding content');
    }
  }
);

app.get(['/admin/edit/:id', '/edit/:id'], requireAdmin, async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item) return res.status(404).send('Media item not found');
    res.render('edit', { item });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Edit Media Route with Cloudflare R2 Upload Support
app.post(
  ['/admin/edit/:id', '/edit/:id'], 
  requireAdmin, 
  upload.fields([{ name: 'posterFile', maxCount: 1 }, { name: 'mediaFile', maxCount: 1 }]), 
  async (req, res) => {
    try {
      let finalPosterUrl = req.body.posterUrl || '';
      let finalGofileUrl = req.body.gofileUrl ? req.body.gofileUrl.trim() : '';

      // Check if a new poster file was uploaded to R2
      if (req.files && req.files.posterFile && req.files.posterFile[0]) {
        finalPosterUrl = await uploadToR2(req.files.posterFile[0]);
      }

      // Check if a new video file was uploaded to R2
      if (req.files && req.files.mediaFile && req.files.mediaFile[0]) {
        finalGofileUrl = await uploadToR2(req.files.mediaFile[0]);
      }

      await Media.findByIdAndUpdate(req.params.id, {
        title: req.body.title,
        type: req.body.type,
        genre: req.body.genre,
        posterUrl: finalPosterUrl,
        subtitleUrl: req.body.subtitleUrl,
        gofileUrl: finalGofileUrl
      });

      res.redirect('/admin');
    } catch (err) {
      console.error('Update Content Error:', err);
      res.status(500).send('Error updating content');
    }
  }
);

app.post(['/delete/:id', '/admin/delete/:id'], requireAdmin, async (req, res) => {
  try {
    await Media.findByIdAndDelete(req.params.id);
    const backUrl = req.get('Referrer') || '/';
    res.redirect(backUrl);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting content');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});