import os
from flask import Flask
app = Flask(__name__)

@app.route("/")
def index():
    return "<p>HOSTNAME: %s</p>" % os.environ['HOSTNAME']

if __name__ == "__main__":
    app.debug = True
    app.run(host='0.0.0.0')
