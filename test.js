require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const validateToken = require('./middleware.js');

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
  const {userID, year, semester, term} = req.query;
  const {rows} = await pool.query(`SELECT "Grades".term, "Grades".id, "Subjects"."Year", "Subjects"."Semester", "Subjects"."Code", "Subjects"."Description", "Grades"."Grade", "Subjects"."LEC", "Subjects"."LAB"
  FROM "Grades" JOIN "Subjects" ON "Subjects"."id" = "Grades"."SubjectID" 
  JOIN student ON student.id = "Grades"."studentID" 
  WHERE student."uID" = $1 AND "Subjects"."Year" = $2 AND "Subjects"."Semester" = $3 AND "Grades".term = $4`, [userID, year, semester, term])
  return rows;
}

// Insert grades as a teacher to a student
async function insertGrades(req){
  const {subjectID, teacherID, studentID, grade, term} = req.query;
  const {rows} = await pool.query(`INSERT INTO "Grades"("SubjectID","studentID","teacherID","Grade", term) 
    VALUES($1, $2, $3, $4, $5)`, [subjectID, studentID, teacherID, grade, term])
  return rows;
}

// Get subjects of a course
async function getSubjects(req){
  const {userID} = req.query;
  const {rows} = await pool.query(`SELECT "Subjects"."Code", "Subjects"."Description", "Subjects"."Year", "Subjects"."Semester", "Subjects"."LEC", "Subjects"."LAB"
FROM "Subjects" JOIN "student" ON "student"."CourseID" = "Subjects"."CourseID" WHERE student."uID" = $1 ORDER BY "Subjects"."id";`, [userID])
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
app.get("/grades", validateToken, async (req, res) => {
  try{
    const data = await getGrades(req);
    res.send(data);
  }catch(error){
    console.error(error);
    res.status(500).json({ error: "Database error" });
  } 
});

// Route to get all subjects of a userID
app.get("/subjects", validateToken, async (req, res) => {
  try{
    const data = await getSubjects(req);
    res.send(data);
  }catch(error){
    console.error(error);
    res.status(500).json({ error: "Database error" });
  } 
});

// Route to insert grades
app.post("/grades",validateToken, async (req, res) => {
  try{
    const data = await insertGrades(req);
    res.send(data);
  }catch(error){
    console.error(error);
    res.status(500).json({ error: "Database error" });
  } 
});





//FUNCTIONS FOR ADMINISTRATOR

// Route to insert a new record
app.post("/account", validateToken, async (req, res) => {
  try {
    const data = await insertRecord(req)
    res.status(200).send(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Insert data
async function insertRecord(req){
  const {email, password, courseID, section, year, role} = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password, "CourseID", "Section", "Year", role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [email, password, courseID, section, year, role]
    );
    return rows[0]; 
  } catch (error) {
    throw new Error("Database insert error: " + error.message);
  }
};

// Route to assign teacher
app.post("/assign", validateToken, async (req, res) => {
  try {
    const data = await assignTeacher(req)
    res.status(200).send(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

async function assignTeacher(req){
  const {teacherID, subjectID, section, courseID, year, semester} = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO "Assignment" ("teacherID", "SubjectID", "Section", "CourseID", "Year", "Semester")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [teacherID, subjectID, section, courseID, year, semester]
    );
    return rows[0]; 
  } catch (error) {
    throw new Error("Database insert error: " + error.message);
  }
};

//For the dropdown
app.get("/teachers", validateToken, async (req, res) => {
  try {
    const data = await getTeachers(req)
    res.status(200).send(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

async function getTeachers(){
  try {
    const { rows } = await pool.query(`SELECT "id", "firstname", "middlename", "lastname" FROM "teacher" 
                                      ORDER BY "lastname", "firstname"`);
    return rows;
  } catch (error) {
    throw new Error("Database fetch error: " + error.message);
  }
};

app.get("/courses", validateToken, async (req, res) => {
  try {
    const data = await getCourses()
    res.status(200).send(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

async function getCourses(){
  try {
    const { rows } = await pool.query(`SELECT "courseCode" FROM "Course" ORDER BY "Description";`);
    return rows;
  } catch (error) {
    throw new Error("Database fetch error: " + error.message);
  }
};

app.get("/sections", validateToken, async (req, res) => {
  try {
    const data = await getSections(req)
    res.status(200).send(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

async function getSections(req){
  const {year, courseID} = req.query;
  try {
    const { rows } = await pool.query(`SELECT DISTINCT "section"
                                        FROM "student"
                                        WHERE "CourseID" = $1
                                        AND "year" = $2
                                        ORDER BY "section"`, [courseID, year]);
    return rows;
  } catch (error) {
    throw new Error("Database fetch error: " + error.message);
  }
};

app.get("/dropdownSubjects", validateToken, async (req, res) => {
  try {
    const data = await getDropdownSubjects(req)
    res.status(200).send(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});

async function getDropdownSubjects(req){
  const {year, courseID, semester} = req.query;
  try {
    const { rows } = await pool.query(`SELECT "id", "Description", "Code" 
FROM "Subjects"
WHERE "CourseID" = $1
AND "Year" = $2
AND "Semester" = $3
ORDER BY id;`, [courseID, year, semester]);
    return rows;
  } catch (error) {
    throw new Error("Database fetch error: " + error.message);
  }
};



const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
