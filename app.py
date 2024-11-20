import os

from dotenv import load_dotenv
from flask import Flask, redirect, render_template, url_for

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev")


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/shop")
def shop():
    return render_template("shop.html")


@app.route("/careers")
def careers():
    return render_template("careers.html")


@app.route("/about")
def about():
    return redirect(url_for("home"))


@app.errorhandler(404)
def page_not_found(e):
    return redirect(url_for("home"))


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
