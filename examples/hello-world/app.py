from flask import Flask
app = Flask(__name__)

from redis import Redis
redis = Redis(host='redis')

@app.route("/")
def hello():
    views = redis.incr('views')
    return "<h1>Hello, world!</h1><p>Page opened: %d times</p>" % views

if __name__ == "__main__":
    app.debug = True
    app.run(host='0.0.0.0')