require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Homepage Route
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

        // Format raw TMDB data so item.poster and item.title match your index.ejs setup
        const formattedCatalog = (data.results || []).map(item => ({
            ...item,
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/500x750',
            title: item.title || item.name || 'Untitled'
        }));

        // Pass catalog, movies, and search to prevent any EJS errors
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});