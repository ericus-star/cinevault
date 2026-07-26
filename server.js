const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware & View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB database'))
    .catch(err => console.error('MongoDB connection error:', err));

// MongoDB Schema for Download Links
const LinkSchema = new mongoose.Schema({
    tmdbId: { type: String, required: true },
    quality: { type: String, required: true },
    fileSize: { type: String, required: true },
    downloadUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Link = mongoose.models.Link || mongoose.model('Link', LinkSchema);

// Genre Definitions
const GENRES = [
    { id: 28, name: 'Action' },
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
    { id: 27, name: 'Horror' },
    { id: 878, name: 'Sci-Fi' },
    { id: 53, name: 'Thriller' },
    { id: 16, name: 'Animation' }
];

// Helper to format TMDB results
function formatCatalog(results) {
    return (results || []).map(item => ({
        id: item.id,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/500x750',
        title: item.title || item.name || 'Untitled',
        release_date: item.release_date || item.first_air_date || ''
    }));
}

// 1. Homepage Route (Trending)
app.get('/', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const searchQuery = req.query.search || '';
        
        let url = `https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}`;
        if (searchQuery) {
            url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        res.render('index', { 
            catalog: formatCatalog(data.results), 
            search: searchQuery, 
            genres: GENRES, 
            activeCategory: searchQuery ? `Search: "${searchQuery}"` : 'Trending Movies & Shows' 
        });
    } catch (error) {
        console.error('Home Route Error:', error.message);
        res.render('index', { catalog: [], search: '', genres: GENRES, activeCategory: 'Trending' });
    }
});

// 2. Movies Route
app.get('/movies', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}`);
        const data = await response.json();

        res.render('index', { catalog: formatCatalog(data.results), search: '', genres: GENRES, activeCategory: 'Popular Movies' });
    } catch (error) {
        res.render('index', { catalog: [], search: '', genres: GENRES, activeCategory: 'Movies' });
    }
});

// 3. TV Shows Route
app.get('/tv', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const response = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}`);
        const data = await response.json();

        res.render('index', { catalog: formatCatalog(data.results), search: '', genres: GENRES, activeCategory: 'Popular TV Shows' });
    } catch (error) {
        res.render('index', { catalog: [], search: '', genres: GENRES, activeCategory: 'TV Shows' });
    }
});

// 4. Genre Filter Route
app.get('/genre/:id', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const genreId = req.params.id;
        
        const response = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genreId}`);
        const data = await response.json();

        const selectedGenre = GENRES.find(g => g.id == genreId)?.name || 'Genre';

        res.render('index', { catalog: formatCatalog(data.results), search: '', genres: GENRES, activeCategory: selectedGenre });
    } catch (error) {
        res.render('index', { catalog: [], search: '', genres: GENRES, activeCategory: 'Genre' });
    }
});

// 5. Single Movie Details Page
app.get('/movie/:id', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const movieId = req.params.id;

        const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}`);
        const movie = await response.json();

        const downloadLinks = await Link.find({ tmdbId: movieId });

        res.render('movie', { movie, downloadLinks });
    } catch (error) {
        console.error('Movie Details Error:', error.message);
        res.status(500).send('Error loading title details');
    }
});

// 6. Admin Panel Page
app.get('/admin', (req, res) => {
    res.render('admin');
});

// 7. Save Download Link (POST)
app.post('/admin/add-link', async (req, res) => {
    try {
        const { tmdbId, quality, fileSize, downloadUrl } = req.body;
        await Link.create({ tmdbId, quality, fileSize, downloadUrl });
        res.redirect(`/movie/${tmdbId}`);
    } catch (error) {
        console.error('Save Link Error:', error.message);
        res.status(500).send('Failed to save download link');
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});