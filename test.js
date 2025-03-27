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
  console.log(`Email takla: ${email}`);
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1",[email]);
    return rows;
  } catch (error) {
    throw new Error("Database fetch error: " + error.message);
  }
};


// Get grades of a student
async function getGrades(req){
  const {userID, year, semester} = req.query;
  const {rows} = await pool.query(`SELECT "Grades".term, "Grades".id, "Subjects"."Year", "Subjects"."Semester", "Subjects"."Code", "Subjects"."Description", "Grades"."Grade", "Subjects"."LEC", "Subjects"."LAB"
  FROM "Grades" JOIN "Subjects" ON "Subjects"."id" = "Grades"."SubjectID" 
  JOIN student ON student.id = "Grades"."studentID" WHERE student."uID" = $1 AND "Subjects"."Year" = $2 AND "Subjects"."Semester" = $3`, [userID, year, semester])
  return rows;
}

// Get subjects of a course
async function getSubjects(req){
  const {userID} = req.query;
  const {rows} = await pool.query(`SELECT "Subjects"."Code", "Subjects"."Description", "Subjects"."Year", "Subjects"."Semester", "Subjects"."LEC", "Subjects"."LAB"
FROM "Subjects" JOIN "student" ON "student"."CourseID" = "Subjects"."CourseID" WHERE student."uID" = $1;`, [userID])
  return rows;
}

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

// Route to fetch Subjects
app.get("/grades", async (req, res) => {
  try{
    const data = await getGrades(req);
    res.send(data);
  }catch(error){
    console.error(error);
    res.status(500).json({ error: "Database error" });
  } 
});

// Route to get all subjects of a userID
app.get("/subjects", async (req, res) => {
  try{
    const data = await getSubjects(req);
    res.send(data);
  }catch(error){
    console.error(error);
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


const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
