require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');

const PORT = process.env.PORT || 3000;

// Set up view engine and static folder
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Homepage Route (Fetches TMDB Trending Movies)
app.get('/', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const response = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`);
        
        if (!response.ok) {
            throw new Error(`TMDB responded with status ${response.status}`);
        }

        const data = await response.json();
        res.render('index', { movies: data.results || [] });
    } catch (error) {
        console.error("Error fetching TMDB data:", error.message);
        res.render('index', { movies: [] });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});