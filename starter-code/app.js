require("dotenv").config();

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const express = require("express");
const favicon = require("serve-favicon");
const hbs = require("hbs");
const mongoose = require("mongoose");
const logger = require("morgan");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/User");
const flash = require("connect-flash");
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

mongoose
  .connect("mongodb://localhost/celebrity", { useNewUrlParser: true })
  .then(x => {
    console.log(
      `Connected to Mongo! Database name: "${x.connections[0].name}"`
    );
  })
  .catch(err => {
    console.error("Error connecting to mongo", err);
  });

const app_name = require("./package.json").name;
const debug = require("debug")(
  `${app_name}:${path.basename(__filename).split(".")[0]}`
);

const app = express();

// Middleware Setup
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Express View engine setup

app.use(
  require("node-sass-middleware")({
    src: path.join(__dirname, "public"),
    dest: path.join(__dirname, "public"),
    sourceMap: true
  })
);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
app.use(express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));

// default value for title local
app.locals.title = "Iron Movies and Celebrities Situation";

app.use(
  session({
    secret: "our-passport-local-strategy-app",
    resave: true,
    saveUninitialized: true
  })
);

app.use(flash());

passport.serializeUser((user, cb) => {
  cb(null, user._id);
});

passport.deserializeUser((id, cb) => {
  User.findById(id, (err, user) => {
    if (err) {
      return cb(err);
    }
    cb(null, user);
  });
});

passport.use(
  new LocalStrategy((username, password, next) => {
    User.findOne({ username }, (err, user) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return next(null, false, { message: "Incorrect username" });
      }
      if (!bcrypt.compareSync(password, user.password)) {
        return next(null, false, { message: "Incorrect password" });
      }

      return next(null, user);
    });
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.msg = req.flash("error");
  res.locals.yay = req.flash("success");
  next();
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLEID,
      clientSecret: process.env.GOOGLESECRET,
      callbackURL: "/auth/google/callback"
    },
    (accessToken, refreshToken, profile, done) => {
      User.findOne({ googleID: profile.id })
        .then(user => {
          if (user) {
            return done(null, user);
          } else {
            ///this else means we did not find the user with this Google ID

            User.findOne({ email: profile._json.email })
              .then(userWithThatEmail => {
                if (userWithThatEmail) {
                  userWithThatEmail.googleID = profile.id;
                  userWithThatEmail
                    .save()
                    .then(updatedUser => {
                      done(null, updatedUser);
                    })
                    .catch(err => {
                      next(err);
                    });
                } else {
                  //this else means there is nobody with that google id
                  //or with that name

                  const newUser = new User({
                    googleID: profile.id,
                    email: profile._json.email
                  });

                  newUser
                    .save()
                    .then(user => {
                      done(null, newUser);
                    })
                    .catch(error => {
                      next(error);
                    });
                }
              })
              .catch(err => {
                next(err);
              });
          }
        })
        .catch(error => {
          next(error);
        });
    }
  )
);

const index = require("./routes/index");
app.use("/", index);

const celebrities = require("./routes/celebrities");
app.use("/", celebrities);

const movies = require("./routes/movies");
app.use("/", movies);

const userRts = require("./routes/userRoutes");
app.use("/", userRts);

module.exports = app;
