import os
import secrets
from urllib.parse import urlencode

import requests
from bson import ObjectId
from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from flask_login import LoginManager, UserMixin, current_user, login_user, logout_user
from pymongo import MongoClient

load_dotenv()

mongodb_url = os.environ.get("MONGO_URI")
client = MongoClient(mongodb_url)
db = client.get_default_database()
users_collection = db.users

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY")
app.config["OAUTH2_PROVIDERS"] = {
    "google": {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
        "authorize_url": "https://accounts.google.com/o/oauth2/auth",
        "token_url": "https://accounts.google.com/o/oauth2/token",
        "userinfo": {
            "url": "https://www.googleapis.com/oauth2/v3/userinfo",
            "email": lambda json: json["email"],
            "name": lambda json: json.get("name", json["email"].split("@")[0]),
            "picture": lambda json: json.get("picture"),
        },
        "scopes": [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
    },
}

login = LoginManager(app)
login.login_view = "login"


class User(UserMixin):
    def __init__(self, user_dict):
        self.id = str(user_dict["_id"])
        self.username = user_dict["username"]
        self.email = user_dict["email"]
        self.profile_picture = user_dict.get("profile_picture")

    def get_id(self):
        return self.id


@login.user_loader
def load_user(user_id):
    user_dict = users_collection.find_one({"_id": ObjectId(user_id)})
    return User(user_dict) if user_dict else None


@app.route("/")
def home():
    return render_template("index.html", active_page="home", dice_num=1)


@app.route("/careers")
def careers():
    return render_template("careers.html", active_page="careers", dice_num=2)


@app.route("/about")
def about():
    return render_template("base.html", active_page="about", dice_num=3)


@app.route("/contact")
def contact():
    return render_template("base.html", active_page="contact", dice_num=4)


@app.route("/logout")
def logout():
    logout_user()
    flash("You have been logged out.")
    return redirect(url_for("index"))


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/authorize/<provider>")
def oauth2_authorize(provider):
    if not current_user.is_anonymous:
        return redirect(url_for("index"))

    provider_data = current_app.config["OAUTH2_PROVIDERS"].get(provider)
    if provider_data is None:
        abort(404)

    session["oauth2_state"] = secrets.token_urlsafe(16)

    qs = urlencode(
        {
            "client_id": provider_data["client_id"],
            "redirect_uri": url_for(
                "oauth2_callback", provider=provider, _external=True
            ),
            "response_type": "code",
            "scope": " ".join(provider_data["scopes"]),
            "state": session["oauth2_state"],
        }
    )

    return redirect(provider_data["authorize_url"] + "?" + qs)


@app.route("/callback/<provider>")
def oauth2_callback(provider):
    if not current_user.is_anonymous:
        return redirect(url_for("index"))

    provider_data = current_app.config["OAUTH2_PROVIDERS"].get(provider)
    if provider_data is None:
        abort(404)

    if "error" in request.args:
        for k, v in request.args.items():
            if k.startswith("error"):
                flash(f"{k}: {v}")
        return redirect(url_for("index"))

    if request.args["state"] != session.get("oauth2_state"):
        abort(401)

    if "code" not in request.args:
        abort(401)

    response = requests.post(
        provider_data["token_url"],
        data={
            "client_id": provider_data["client_id"],
            "client_secret": provider_data["client_secret"],
            "code": request.args["code"],
            "grant_type": "authorization_code",
            "redirect_uri": url_for(
                "oauth2_callback", provider=provider, _external=True
            ),
        },
        headers={"Accept": "application/json"},
    )
    if response.status_code != 200:
        abort(401)
    oauth2_token = response.json().get("access_token")
    if not oauth2_token:
        abort(401)

    response = requests.get(
        provider_data["userinfo"]["url"],
        headers={
            "Authorization": "Bearer " + oauth2_token,
            "Accept": "application/json",
        },
    )
    if response.status_code != 200:
        abort(401)

    user_info = response.json()
    email = provider_data["userinfo"]["email"](user_info)
    username = provider_data["userinfo"]["name"](user_info)
    profile_picture = provider_data["userinfo"]["picture"](user_info)

    existing_user = users_collection.find_one({"email": email})

    if existing_user is None:
        result = users_collection.insert_one(
            {"username": username, "email": email, "profile_picture": profile_picture}
        )
        user_dict = {
            "_id": result.inserted_id,
            "username": username,
            "email": email,
            "profile_picture": profile_picture,
        }
        user = User(user_dict)
    else:
        if existing_user.get("profile_picture") != profile_picture:
            users_collection.update_one(
                {"_id": existing_user["_id"]},
                {"$set": {"profile_picture": profile_picture}},
            )
        user = User(existing_user)

    login_user(user)
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(debug=True)
