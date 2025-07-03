const express = require("express");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const app = express();
const Post = require("./models/post");
const Comment = require("./models/comment");
const multer = require("multer");
const path = require("path");
const User = require("./models/users");
const LocalStrategy = require("passport-local");
const Message = require("./models/message");

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

async function isAuthor(req, res, next) {
  const { id } = req.params;
  const post = await Post.findById(id);
  if (!post.author.equals(req.user._id)) {
    return res.redirect("/posts");
  }
  next();
}
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
app.use(methodOverride("_method")); // method-overrideの設定を追加
app.use(express.static("public")); // 静的ファイルのルートを先に配置

// すべてのルートでcurrentUserを利用可能にする
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

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

// ルートの順序を整理
app.get("/home", (req, res) => {
  console.log("home");
  res.render("posts/home");
});

app.get("/posts/new", isLoggedIn, (req, res) => {
  console.log("new ページ");
  res.render("posts/new");
});

// 一覧表示
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find().populate("author");
    return res.render("posts/index", {
      posts: posts,
      currentUser: req.user,
    });
  } catch (err) {
    console.error("Error fetching posts:", err);
    return res.render("posts/index", {
      posts: [],
      currentUser: req.user,
      error: "投稿の取得中にエラーが発生しました",
    });
  }
});

// 詳細表示（IDを使用するルートは後に配置）
app.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate({
        path: "comments",
        populate: { path: "author" },
      })
      .populate("author");

    if (!post) {
      return res.redirect("/posts");
    }

    res.render("posts/show", { post, currentUser: req.user });
  } catch (err) {
    console.error("投稿取得エラー:", err);
    res.redirect("/posts");
  }
});

// 編集ページ
app.get("/posts/:id/edit", isLoggedIn, isAuthor, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.redirect("/posts");
  }
  res.render("posts/edit", { post });
});

app.post("/posts", isLoggedIn, upload.single("image"), async (req, res) => {
  try {
    const { title, note } = req.body;
    console.log("Creating post with user:", req.user);

    let image = null;
    if (req.file) {
      image = "/uploads/" + req.file.filename;
    }

    const post = new Post({
      title,
      note,
      image,
      author: req.user._id,
    });

    const savedPost = await post.save();
    console.log("Created post:", savedPost);

    res.redirect("/posts");
  } catch (err) {
    console.error("投稿作成エラー:", err);
    res.redirect("/posts");
  }
});

app.post("/posts/:id/comments", isLoggedIn, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.redirect("/posts");
    }

    const comment = new Comment({
      body: req.body.body,
      author: req.user._id,
    });

    await comment.save();
    post.comments.push(comment); // comments（複数形）に修正
    await post.save();

    res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.error("コメント作成エラー:", err);
    res.redirect("/posts");
  }
});

app.put("/posts/:id", isLoggedIn, isAuthor, async (req, res) => {
  const { id } = req.params;
  const { title, note, image } = req.body;
  await Post.findByIdAndUpdate(id, { title, note, image });
  res.redirect("/posts"); // 編集後も投稿一覧へ
});

app.delete("/posts/:id", isLoggedIn, isAuthor, async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.redirect("/posts"); // 削除後も投稿一覧へ
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
      res.redirect("/posts"); // ログイン後も投稿一覧へ
    });
  } catch (e) {
    res.send("ログインエラー：" + e.message);
  }
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/posts"); // ログアウト後も投稿一覧へ
  });
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
      res.redirect("/posts/new"); // 新規登録後も投稿一覧へ
    });
  } catch (e) {
    res.send("エラー：", e.message);
  }
});
//DMの準備
app.get("/users", isLoggedIn, async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }); //自分以外
  res.render("users/index", { users });
});
app.get("/messages/:id", isLoggedIn, async (req, res) => {
  const otherUserId = req.params.id;

  const messages = await Message.find({
    $or: [
      { sender: req.user._id, receiver: otherUserId },
      { sender: otherUserId, receiver: req.user._id },
    ], //自分が送って相手が受け取ったメッセージとその逆を一緒に取得
  })
    .populate("sender")
    .populate("receiver")
    .sort("createAt"); //古い順に並べる

  const otherUser = await User.findById(otherUserId);
  res.render("messages/thread", { messages, otherUser });
});
app.post("/messages/:id", isLoggedIn, async (req, res) => {
  const newMessage = new Message({
    body: req.body.body, //フォームから送られてきた本文
    sender: req.user._id,
    receiver: req.params.id,
  });
  await newMessage.save();
  res.redirect(`/messages/${req.params.id}`);
});

app.listen(3000, () => {
  console.log("サーバが3000に接続しました");
});
