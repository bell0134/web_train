const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const postSchema = new Schema({
  title: String,
  note: String,
  //   image: String,
});

module.exports = mongoose.model("Post", postSchema);
