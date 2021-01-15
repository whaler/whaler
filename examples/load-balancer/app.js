const util = require('util');
const http = require('http');

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(util.format('<p>HOSTNAME: %s</p>', process.env.HOSTNAME));
});

server.listen(5000, '0.0.0.0', () => {
    console.log(`Server started`);
});