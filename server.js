const express = require('express');
const axios = require('axios');
const app = express();

// Set up EJS view engine
app.set('view engine', 'ejs');

// TMDB API Configuration (Replace with your actual TMDB API Key)
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY';

// Movie details route
app.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;

  try {
    // 1. Fetch movie info dynamically from TMDB
    const tmdbResponse = await axios.get(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
    );
    const movieData = tmdbResponse.data;

    // 2. Check MongoDB for a custom Gofile download link (Optional fallback/custom link)
    // Assuming you have a Link model setup like: Link.findOne({ tmdbId })
    let customLink = null;
    if (typeof Link !== 'undefined') {
      customLink = await Link.findOne({ tmdbId: tmdbId });
    }

    // 3. Render the view with embed streaming sources generated automatically
    res.render('movie', {
      movie: {
        tmdbId: tmdbId,
        title: movieData.title,
        overview: movieData.overview,
        posterPath: movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : null,
        backdropPath: movieData.backdrop_path ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}` : null,
        releaseYear: movieData.release_date ? movieData.release_date.split('-')[0] : 'N/A',
        voteAverage: movieData.vote_average ? movieData.vote_average.toFixed(1) : 'N/A',
        // Dynamic Embed Player URLs
        embedPrimary: `https://vidsrc.to/embed/movie/${tmdbId}`,
        embedSecondary: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
        // Custom link from MongoDB if you uploaded one
        customDownloadUrl: customLink ? customLink.downloadUrl : null,
        fileSize: customLink ? customLink.fileSize : null,
        quality: customLink ? customLink.quality : null
      }
    });
  } catch (error) {
    console.error('Error loading movie:', error.message);
    res.status(500).send('Error loading movie details.');
  }
});