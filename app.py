import os

from flask import Flask, render_template

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY")


@app.route("/")
def home():
    return render_template("index.html", active_page="home", dice_num=1)


@app.route("/shop")
def shop():
    return render_template("shop.html", active_page="shop", dice_num=2)


@app.route("/careers")
def careers():
    return render_template("careers.html", active_page="careers", dice_num=3)


@app.route("/about")
def about():
    return render_template("about.html", active_page="about", dice_num=4)


if __name__ == "__main__":
    app.run(debug=True)
