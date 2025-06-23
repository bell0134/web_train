const express = require("express");
const mongoose = require("mongoose");
const app = express();
const Post = require("./models/post");

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
  res.send("ホームへようこそ");
});

app.use(express.urlencoded({ extended: true }));

app.get("/posts/new", (req, res) => {
  console.log("new ページ");
  res.render("posts/new");
});

app.get("/posts", async (req, res) => {
  const posts = await Post.find();
  res.render("posts/index", { posts });
});

app.post("/posts", async (req, res) => {
  const { title, note } = req.body;
  //   console.log(title);
  await Post.create({ title, note });
  res.redirect("/posts");
});

app.listen(3000, () => {
  console.log("サーバが3000に接続しました");
});
