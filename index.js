var express = require("express");
const app = express();
require("dotenv").config();
var path = require("path");

var cors = require("cors");
var session = require("express-session");
var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
const multer = require("multer");
var exe = require("./connection.js");

const fs = require("fs");

const authMiddleware = require("./authMiddleware.js");

//  CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

//  Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//  Static folder
app.use(express.static("public"));

//  Session config
app.use(
  session({
    secret: "prachi",
    resave: true,
    saveUninitialized: true,
  }),
);

//  Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage });
app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

// home route
app.get("/", (req, res) => {
  res.json({ message: "Server started" });
});

// API Routes
app.get("/api/service", async (req, res) => {
  try {
    const data = await exe("SELECT * FROM service");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/team", async (req, res) => {
  try {
    const data = await exe("SELECT * FROM team");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/meals", async (req, res) => {
  try {
    const data = await exe("SELECT * FROM meals");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/user/bookings", authMiddleware, async (req, res) => {
  try {
    const sql = `
      SELECT id, name, email, phone, date, time, persons, special_request, created_at
      FROM bookings
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    const data = await exe(sql, [req.userId]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/user/profile", authMiddleware, async (req, res) => {
  try {
    const sql = `
      SELECT id, name, email
      FROM users
      WHERE id = ?
    `;
    const data = await exe(sql, [req.userId]);
    res.json(data[0]);
  } catch (err) {
    console.error("PROFILE ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

app.get("/user/contacts", authMiddleware, async (req, res) => {
  try {
    const sql = `
      SELECT id, subject, message, created_at
      FROM contacts
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    const data = await exe(sql, [req.userId]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin Login
app.post("/admin/login", async (req, res) => {
  const { admin_email, admin_pass } = req.body;

  const data = await exe("SELECT * FROM admin WHERE email = ?", [admin_email]);
  if (data.length === 0) {
    return res.status(401).json({ message: "Invalid email" });
  }

  const isMatch = await bcrypt.compare(admin_pass, data[0].password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const token = jwt.sign({ id: data[0].id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.json({ message: "Login successful", token });
});

// Save Service
app.post("/admin/saveservice", upload.single("serv_img"), async (req, res) => {
  try {
    const { serv_name, serv_info } = req.body;
    const image = req.file.filename;

    await exe(
      "INSERT INTO service (name, description, image) VALUES (?, ?, ?)",
      [serv_name, serv_info, image],
    );

    res.status(201).json({ message: "Service added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/admin/delete_serv/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const data = await exe("SELECT image FROM service WHERE id=?", [id]);
    if (data.length === 0)
      return res.status(404).json({ message: "Service not found" });

    const imgPath = `public/uploads/${data[0].image}`;
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

    await exe("DELETE FROM service WHERE id=?", [id]);
    res.json({ message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//add team
app.post("/admin/add-team", upload.single("image"), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image required" });
    }

    const image = req.file.filename;

    const sql = `
      INSERT INTO team (name, image, role)
      VALUES (?, ?, ?)
    `;

    await exe(sql, [name, image, description]);

    res.status(201).json({ message: "Team member added successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.delete("/admin/delete-team/:id", async (req, res) => {
  try {
    const data = await exe("SELECT image FROM team WHERE id=?", [
      req.params.id,
    ]);
    if (data.length === 0) return res.sendStatus(404);

    fs.unlinkSync(`public/uploads/${data[0].image}`);
    await exe("DELETE FROM team WHERE id=?", [req.params.id]);

    res.json({ message: "Team member deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Booking

app.post("/admin/bookings", authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, date, time, people, special_request } =
      req.body;

    const user_id = req.userId;

    const sql = `
      INSERT INTO bookings 
      (user_id,	name,	email,	phone,	date,	time,	persons,	special_request)
      VALUES (?, ?, ?, ?, ?, ?, ?,?)
    `;

    await exe(sql, [
      user_id,
      name,
      email,
      phone,
      date,
      time,
      people,
      special_request,
    ]);

    res.status(201).json({ message: "Booking Confirmed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/user/bookings/:id", authMiddleware, async (req, res) => {
  try {
    const sql = `
      DELETE FROM bookings
      WHERE id = ? and user_id=?
    `;

    const result = await exe(sql, [req.params.id, req.userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ message: "Booking cancelled" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/user/profile", authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;

    const sql = `
      UPDATE users
      SET name = ?, email = ?
      WHERE id = ?
    `;

    await exe(sql, [name, email, req.userId]);
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/user/delete", authMiddleware, async (req, res) => {
  try {
    // delete user contacts first (FK safety)
    await exe("DELETE FROM contacts WHERE user_id = ?", [req.userId]);
    await exe("DELETE FROM bookings WHERE user_id = ?", [req.userId]);

    // delete user
    const result = await exe("DELETE FROM users WHERE id = ?", [req.userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("DELETE USER ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/admin/delete-user/:id", authMiddleware, async (req, res) => {
  try {
    await exe("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get("/admin/bookings", async (req, res) => {
  try {
    const data = await exe("SELECT * FROM bookings ORDER BY created_at DESC");
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/admin/contacts", async (req, res) => {
  try {
    const data = await exe("SELECT * FROM contacts ORDER BY created_at DESC");
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.get("/admin/users", async (req, res) => {
  try {
    const data = await exe(
      "SELECT id, name, email, password, created_at FROM users",
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//user signup
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 1️ Check if email already exists
    const checkSql = "SELECT * FROM users WHERE email = ?";
    const existingUser = await exe(checkSql, [email]);

    if (existingUser.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // 2️ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️ Insert user
    const insertSql =
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    const result = await exe(insertSql, [username, email, hashedPassword]);

    return res.status(201).json({
      message: "User registered successfully",
      userId: result.insertId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/signin", async (req, res) => {
  try {
    const { username, userpass } = req.body;
    var sql = "SELECT* FROM users WHERE name=?";
    var data = await exe(sql, [username]);

    if (data.length === 0) {
      return res.status(400).json({ message: "Username not exists" });
    }

    const isMatch = await bcrypt.compare(userpass, data[0].password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }
    const token = jwt.sign({ id: data[0].id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return res.status(200).json({ message: "Login Successfully", token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/admin/saveContact", authMiddleware, async (req, res) => {
  try {
    const { name, email, subj, msg } = req.body;
    const user_id = req.userId;

    if (!name || !email || !msg) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const sql = `
      INSERT INTO contacts (user_id, name, email, subject, message)
      VALUES (?, ?, ?, ?, ?)
    `;

    await exe(sql, [user_id, name, email, subj, msg]);

    return res.status(200).json({ message: "Message sent successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


app.put("/user/contacts/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;

    // Validation
    if (!subject || !message) {
      return res
        .status(400)
        .json({ message: "Subject and message are required" });
    }

    const sql = `
      UPDATE contacts
      SET subject = ?, message = ?
      WHERE id = ? AND user_id = ?
    `;

    const result = await exe(sql, [subject, message, id, req.userId]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Contact not found or not authorized" });
    }

    res.status(200).json({ message: "Contact updated successfully" });
  } catch (err) {
    console.error("UPDATE CONTACT ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/user/contacts/:id", authMiddleware, async (req, res) => {
  try {
    const sql = `
      DELETE FROM contacts
      WHERE id = ? AND user_id = ?
    `;

    const result = await exe(sql, [req.params.id, req.userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.json({ message: "Contact deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await exe("DELETE FROM service WHERE id = ? ", [id]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Service not found or not authorized" });
    }

    res.status(200).json({ message: "Service deleted successfully" });
  } catch (err) {
    console.error("DELETE SERVICE ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// meal

//* 🔹 GET MEALS */
app.get("/api/meals", async (req, res) => {
  try {
    const meals = await exe("SELECT * FROM meals");
    res.json(meals);
  } catch (err) {
    res.status(500).json(err);
  }
});

/* 🔹 ADD MEAL */
app.post("/admin/add-meal", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, meal_type } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image required" });
    }

    await exe(
      "INSERT INTO meals (name, description, price, type, image) VALUES (?,?,?,?,?)",
      [name, description, price, meal_type, req.file.filename],
    );

    res.json({ message: "Meal added successfully" });
  } catch (err) {
    res.status(500).json(err);
  }
});

/* 🔹 DELETE MEAL */
app.delete("/admin/delete-meal/:id", async (req, res) => {
  try {
    await exe("DELETE FROM meals WHERE id = ?", [req.params.id]);
    res.json({ message: "Meal deleted successfully" });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
