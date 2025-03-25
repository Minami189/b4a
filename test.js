require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL, 
  ssl: { rejectUnauthorized: false }, 
});


// Login
async function getAccount(req){
  const {email} = req.query;
  try {
    const { user } = await pool.query("SELECT * FROM users WHERE email = $1",[email]);
    return user;
  } catch (error) {
    throw new Error("Database fetch error: " + error.message);
  }
};

// Insert data
async function insertRecord( firstname, lastname, middlename, age, email, password){
  try {
    const { rows } = await pool.query(
      "INSERT INTO users (firstname, lastname, middlename, age, email, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [ firstname, lastname, middlename, age, email, password]
    );
    return rows[0]; 
  } catch (error) {
    throw new Error("Database insert error: " + error.message);
  }
};

// Route to fetch all records
app.get("/login", async (req, res) => {
  try {
    const data = await getAccount(req);
    res.json(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Route to insert a new record
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


const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
