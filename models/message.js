const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const dmSchema = new Schema({
  body: String,
  sender: { type: Schema.Types.ObjectId, ref: "User" }, //送った人の情報
  receiver: { type: Schema.Types.ObjectId, ref: "User" }, //受け取った人の情報
  createdAt: { type: Date, default: Date.now }, //いつ送ったか
});

module.exports = mongoose.model("dm", dmSchema);
