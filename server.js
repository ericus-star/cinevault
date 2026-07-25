require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const MovieLink = require('./models/MovieLink');

const app = express();
const PORT = process.env.PORT || 10000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB database'))
  .catch(err => console.error('Database connection error:', err));

// Middleware setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// 1. Homepage Route
app.get('/', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const searchQuery = req.query.search || '';
        
        let url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`;
        if (searchQuery) {
            url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        const formattedCatalog = (data.results || []).map(item => ({
            ...item,
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/500x750',
            title: item.title || item.name || 'Untitled',
            release_date: item.release_date || item.first_air_date || ''
        }));

        res.render('index', { 
            catalog: formattedCatalog,
            movies: formattedCatalog, 
            search: searchQuery 
        });
    } catch (error) {
        console.error("Error fetching TMDB data:", error.message);
        res.render('index', { catalog: [], movies: [], search: '' });
    }
});

// 2. Movie Details Route with Database Download Links
app.get('/movie/:id', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const movieId = req.params.id;
        
        const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${apiKey}`);
        if (!response.ok) throw new Error(`Movie not found`);

        const movieData = await response.json();

        // Fetch download links matching this TMDB ID from MongoDB
        const linkData = await MovieLink.findOne({ movieId: movieId });
        movieData.downloadLinks = linkData ? linkData.links : [];

        res.render('details', { movie: movieData });
    } catch (error) {
        console.error("Error fetching movie details:", error.message);
        res.redirect('/');
    }
});

// 3. Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});