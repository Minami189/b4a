require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// 🔹 PostgreSQL Pool (Connect to Supabase)
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL, // Secure in .env
  ssl: { rejectUnauthorized: false }, // Required for Supabase
});

// 🔹 Async function to fetch all records
const getAllRecords = async () => {
  try {
    const { rows } = await pool.query("SELECT * FROM users");
    return rows;
  } catch (error) {
    throw new Error("Database fetch error: " + error.message);
  }
};

// 🔹 Async function to insert data
const insertRecord = async ( firstname, lastname, middlename, age, email, password) => {
  try {
    const { rows } = await pool.query(
      "INSERT INTO users (firstname, lastname, middlename, age, email, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [ firstname, lastname, middlename, age, email, password]
    );
    return rows[0]; // Return the inserted row
  } catch (error) {
    throw new Error("Database insert error: " + error.message);
  }
};

// 🔹 Route to fetch all records
app.get("/test", async (req, res) => {
  try {
    const data = await getAllRecords();
    console.log(data)
    res.json(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

// 🔹 Route to insert a new record
app.post("/test", async (req, res) => {
  try {
    console.log(req.body)
    const { firstname, lastname, middlename, age, email, password } = req.body;
    const newRecord = await insertRecord( firstname, lastname, middlename, age, email, password);
    res.json({ message: "Success", data: newRecord });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

// 🔹 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
