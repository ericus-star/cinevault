const fs = require('fs');
const path = require('path');

// Ensure directories exist
['data', 'public', 'views'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// 1. Write catalog.json
const catalogData = [
    {
        id: 1,
        title: "Sample Movie",
        genre: "Action",
        year: "2026",
        poster: "https://via.placeholder.com/200x300",
        description: "An exciting preview item.",
        downloadUrl: "https://example.com/file.mp4"
    }
];
fs.writeFileSync('data/catalog.json', JSON.stringify(catalogData, null, 2));

// 2. Write views/index.ejs
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>NKIRI HUB</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <header class="navbar">
        <div class="logo"><h1>NKIRI<span>HUB</span></h1></div>
        <form action="/" method="GET" class="search-box">
            <input type="text" name="search" placeholder="Search..." value="<%= search %>">
            <button type="submit">Search</button>
        </form>
        <a href="/admin" class="btn admin-btn">+ Add Content</a>
    </header>
    <main class="container">
        <h2 class="section-title">Latest Releases</h2>
        <div class="catalog-grid">
            <% catalog.forEach(item => { %>
                <div class="card">
                    <div class="poster-container">
                        <img src="<%= item.poster %>" alt="<%= item.title %>">
                        <span class="badge"><%= item.year %></span>
                    </div>
                    <div class="card-body">
                        <h3><%= item.title %></h3>
                        <p class="genre"><%= item.genre %></p>
                        <a href="<%= item.downloadUrl %>" target="_blank" class="download-btn">Download</a>
                    </div>
                </div>
            <% }) %>
        </div>
    </main>
</body>
</html>`;
fs.writeFileSync('views/index.ejs', indexHtml);

// 3. Write views/admin.ejs
const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Admin Dashboard</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <header class="navbar">
        <div class="logo"><h1>NKIRI<span>HUB</span> - Admin</h1></div>
        <a href="/" class="btn admin-btn">Back to Home</a>
    </header>
    <main class="form-container">
        <form action="/admin/add" method="POST">
            <label>Title:</label>
            <input type="text" name="title" required>
            <label>Genre:</label>
            <input type="text" name="genre" required>
            <label>Year:</label>
            <input type="text" name="year" required>
            <label>Poster Image URL:</label>
            <input type="url" name="poster" required>
            <label>Description:</label>
            <textarea name="description" required></textarea>
            <label>Download Link URL:</label>
            <input type="url" name="downloadUrl" required>
            <button type="submit" class="download-btn">Add Entry</button>
        </form>
    </main>
</body>
</html>`;
fs.writeFileSync('views/admin.ejs', adminHtml);

console.log("All project files successfully regenerated!");