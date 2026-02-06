const express = require('express');
const app = express();

try {
    app.get('/{*path}', (req, res) => {
        res.send('Got it');
    });
    console.log('Route /{*path} registered successfully');

    app.listen(3001, () => {
        console.log('Server listening on 3001');
        process.exit(0);
    });
} catch (e) {
    console.error('Crash registering route:', e.message);
}
