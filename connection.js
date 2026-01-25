var mysql = require("mysql");
var dotenv=require("dotenv");
dotenv.config();

var conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "restoran",
});

conn.connect((err, data) => {
  if (!err) {
    console.log("Connect Successfully");
  } else {
    console.log(err);
  }
});

var util = require("util");
var exe = util.promisify(conn.query).bind(conn);

module.exports = exe;
