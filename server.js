const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const DATA_FILE = path.join(__dirname, 'data', 'catalog.json');

function getCatalog() {
    const rawData = fs.readFileSync(DATA_FILE);
    return JSON.parse(rawData);
}

app.get('/', (req, res) => {
    let catalog = getCatalog();
    const searchQuery = req.query.search;
    if (searchQuery) {
        catalog = catalog.filter(item => 
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.genre.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    res.render('index', { catalog, search: searchQuery || '' });
});

app.get('/admin', (req, res) => {
    res.render('admin');
});

app.post('/admin/add', (req, res) => {
    const catalog = getCatalog();
    const newItem = {
        id: Date.now(),
        title: req.body.title,
        genre: req.body.genre,
        year: req.body.year,
        poster: req.body.poster,
        description: req.body.description,
        downloadUrl: req.body.downloadUrl
    };
    catalog.push(newItem);
    fs.writeFileSync(DATA_FILE, JSON.stringify(catalog, null, 2));
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
