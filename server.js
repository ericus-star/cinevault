require('dotenv').config();
const express = require('express');
const app = express();

// ... keep your existing app.set / express middleware settings here ...

// YOUR UPDATED HOMEPAGE ROUTE
app.get('/', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        
        // Fetch trending movies from TMDB
        const response = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`);
        const data = await response.json();

        // Pass real movies to your view template
        res.render('index', { movies: data.results });
    } catch (error) {
        console.error("Error fetching TMDB data:", error);
        res.render('index', { movies: [] });
    }
});

// ... keep your app.listen(PORT...) at the bottom ...