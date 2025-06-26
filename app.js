const express = require("express");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const app = express();
const Post = require("./models/post");
const multer = require("multer");
const path = require("path");
const User = require("./models/users");
const LocalStrategy = require("passport-local");

// 画像アップロード用の設定
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "public/uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

app.use(
  session({
    secret: "keyboad cat",
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser()); //決まり文句

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

mongoose
  .connect("mongodb://127.0.0.1:27017/LineApp", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDBに接続しました");
  })
  .catch((err) => {
    console.error("❌ MongoDB接続エラー:", err);
  });

app.get("/home", (req, res) => {
  console.log("home");
  // res.send("ホームへようこそ");
  res.render("posts/home");
});

app.get("/posts/new", (req, res) => {
  console.log("new ページ");
  res.render("posts/new");
});

app.get("/posts", async (req, res) => {
  const posts = await Post.find();
  res.render("posts/index", { posts });
});

app.post("/posts", upload.single("image"), async (req, res) => {
  const { title, note } = req.body;
  let image = null;
  if (req.file) {
    image = "/uploads/" + req.file.filename;
  }
  await Post.create({ title, note, image });
  res.redirect("/posts");
});

app.get("/login", (req, res) => {
  res.render("users/login");
});

app.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      throw new Error("ユーザーが見つかりません");
    }

    // パスポートのauthenticateメソッドを手動で呼び出す
    const authenticate = User.authenticate();
    const { user: authenticatedUser } = await authenticate(username, password);

    if (!authenticatedUser) {
      throw new Error("パスワードが正しくありません");
    }

    // ログイン処理
    req.login(authenticatedUser, (err) => {
      if (err) return next(err);
      res.redirect("/posts");
    });
  } catch (e) {
    res.send("ログインエラー：" + e.message);
  }
});

app.get("/register", (req, res) => {
  res.render("users/register");
});
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email });
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      res.redirect("/posts");
    });
  } catch (e) {
    res.send("エラー：", e.message);
  }
});

app.listen(3000, () => {
  console.log("サーバが3000に接続しました");
});
