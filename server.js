app.get('/', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const searchQuery = req.query.search || '';
        
        let url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`;
        
        // If the user typed something in search, query TMDB search endpoint instead
        if (searchQuery) {
            url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        // Pass BOTH movies AND search to index.ejs
        res.render('index', { 
            movies: data.results || [], 
            search: searchQuery 
        });
    } catch (error) {
        console.error("Error fetching TMDB data:", error.message);
        res.render('index', { movies: [], search: '' });
    }
});