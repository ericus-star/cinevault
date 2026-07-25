const mongoose = require('mongoose');

const movieLinkSchema = new mongoose.Schema({
  movieId: { type: String, required: true, unique: true },
  links: [
    {
      quality: String,
      size: String,
      url: String
    }
  ]
});

module.exports = mongoose.model('MovieLink', movieLinkSchema);