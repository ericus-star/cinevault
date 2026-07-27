const express = require('express');
const app = express();

// Set view engine
app.set('view engine', 'ejs');

// Get TMDB API Key from environment or fallback
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

// Dynamic Movie Streaming Route
app.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;

  try {
    let movieData = { title: `Movie #${tmdbId}`, overview: '', release_date: '', vote_average: 0 };

    // Fetch TMDB data if API Key exists
    if (TMDB_API_KEY) {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
      );
      if (response.ok) {
        movieData = await response.json();
      }
    }

    // Check MongoDB for custom link if model exists safely
    let customLink = null;
    try {
      if (typeof Link !== 'undefined') {
        customLink = await Link.findOne({ tmdbId: tmdbId });
      }
    } catch (dbErr) {
      console.log('Database lookup bypassed or model not found');
    }

    // Render EJS with dynamic embed sources
    res.render('movie', {
      movie: {
        tmdbId: tmdbId,
        title: movieData.title || 'Unknown Title',
        overview: movieData.overview || 'No overview available.',
        releaseYear: movieData.release_date ? movieData.release_date.split('-')[0] : 'N/A',
        voteAverage: movieData.vote_average ? Number(movieData.vote_average).toFixed(1) : 'N/A',
        // Reliable Embed Providers
        embedPrimary: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
        embedSecondary: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
        // Custom Gofile link if present
        customDownloadUrl: customLink ? customLink.downloadUrl : null,
        fileSize: customLink ? customLink.fileSize : null,
        quality: customLink ? customLink.quality : null
      }
    });

  } catch (error) {
    console.error('Error rendering movie page:', error);
    res.status(500).send('Server Error loading player page.');
  }
});