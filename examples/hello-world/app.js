const util = require('util');
const http = require('http');
const redis = require("redis");

const printRedisError = err => console.error('Redis error: ', err);

const client = redis.createClient({ host: 'redis' });
client.on('error', printRedisError);

const server = http.createServer((req, res) => {
    client.incr('views', (err, views) => {
        res.setHeader('Content-Type', 'text/html');
        if (err) {
            printRedisError(err);
            res.statusCode = 500;
            res.end('<h1>Internal Server Error</h1>');
        } else {
            res.statusCode = 200;
            res.end(util.format('<h1>Hello, world!</h1><p>Page opened: %d times</p>', views));
        }
    });
});

server.listen(5000, '0.0.0.0', () => {
    console.log(`Server started`);
});