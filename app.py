import os

from flask import Flask, redirect, render_template, url_for

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev")


@app.route("/")
def home():
    return render_template("index.html", active_page="home")


@app.route("/shop")
def shop():
    return render_template("shop.html", active_page="shop")


@app.route("/careers")
def careers():
    return render_template("careers.html", active_page="careers")


@app.route("/about")
def about():
    return redirect(url_for("home"))


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
