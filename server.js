// List of common TMDB genres for quick filtering
const GENRES = [
    { id: 28, name: 'Action' },
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
    { id: 27, name: 'Horror' },
    { id: 878, name: 'Sci-Fi' },
    { id: 53, name: 'Thriller' },
    { id: 16, name: 'Animation' }
];

// Helper function to format TMDB results consistently
function formatCatalog(results) {
    return (results || []).map(item => ({
        ...item,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/500x750',
        title: item.title || item.name || 'Untitled',
        release_date: item.release_date || item.first_air_date || '',
        media_type: item.title ? 'movie' : 'tv'
    }));
}

// 1. Homepage (Trending Content)
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
        const catalog = formatCatalog(data.results);

        res.render('index', { catalog, search: searchQuery, genres: GENRES, activeCategory: 'Home' });
    } catch (error) {
        console.error("Error fetching home data:", error.message);
        res.render('index', { catalog: [], search: '', genres: GENRES, activeCategory: 'Home' });
    }
});

// 2. Movies Only Route
app.get('/movies', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}`);
        const data = await response.json();

        res.render('index', { catalog: formatCatalog(data.results), search: '', genres: GENRES, activeCategory: 'Movies' });
    } catch (error) {
        res.render('index', { catalog: [], search: '', genres: GENRES, activeCategory: 'Movies' });
    }
});

// 3. TV Shows Only Route
app.get('/tv', async (req, res) => {
    try {
        const apiKey = process.env.TMDB_API_KEY;
        const response = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}`);
        const data = await response.json();

        res.render('index', { catalog: formatCatalog(data.results), search: '', genres: GENRES, activeCategory: 'TV Shows' });
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