require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const validateToken = require('./middleware.js');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
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
  const {rows} = await pool.query(`SELECT "Grades".term, "Subjects".id, "Subjects"."Year", "Subjects"."Semester", "Subjects"."Code", "Subjects"."Description", "Grades"."Grade", "Subjects"."LEC", "Subjects"."LAB"
  FROM "Grades" JOIN "Subjects" ON "Subjects"."id" = "Grades"."SubjectID" 
  JOIN student ON student.id = "Grades"."studentID" 
  WHERE student."uID" = $1 AND "Subjects"."Year" = $2 AND "Subjects"."Semester" = $3 AND "Grades".term = $4`, [userID, year, semester, term])
  return rows;
}

// Insert grades as a teacher to a student
async function insertGrades(req){
  const {subjectID, teacherID, studentID, grade, term} = req.query;
  const {rows} = await pool.query(`INSERT INTO "Grades" ("SubjectID", "studentID", "teacherID", "Grade", term)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT ("SubjectID", "studentID", term) 
    DO UPDATE SET 
    "Grade" = COALESCE(EXCLUDED."Grade", "Grades"."Grade"),
    "teacherID" = EXCLUDED."teacherID"
    RETURNING *;`, [subjectID, studentID, teacherID, grade, term])
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

//Route to get a grade 
app.get("/grade",validateToken, async (req, res) => {
  try{
    const data = await getGrade(req);
    res.send(data);
  }catch(error){
    console.error(error);
    res.status(500).json({ error: "Database error" });
  } 
});

async function getGrade(req){
  const {userID, subjectID} = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT "Grades"."Grade", "Grades".term FROM "Grades" JOIN student ON "Grades"."studentID" = student.id 
      WHERE student."uID" = $1 AND "Grades"."SubjectID" = $2`,
      [userID, subjectID]
    );
    return rows; 
  } catch (error) {
    throw new Error("Database insert error: " + error.message);
  }
};

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

//Route to get all assigned students of a teacher
app.get("/students", validateToken, async (req,res)=>{
  try {
    const data = await getStudents(req)
    res.status(200).send(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Database error" });
  }
});
//Function to get all students
async function getStudents(req){
  const {teacherID, section, year, courseID} = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT
    "student"."id" AS studentid,
    "student"."firstname",
    "student"."middlename", 
    "student"."lastname",
    "student"."section",
    "Subjects".id AS subjectid,
    "Subjects"."Description" AS subject_name,
    "Subjects"."Code" AS subject_code,
    "Subjects"."Year",
    "Subjects"."Semester"
FROM public."Assignment"
JOIN public."Subjects" 
    ON "Assignment"."SubjectID" = "Subjects"."id"
JOIN public."student" 
    ON "student"."CourseID" = "Subjects"."CourseID"
    AND "student"."year" = "Subjects"."Year"
    AND "student"."section" = "Assignment"."Section"
JOIN public."teacher"
    ON "Assignment"."teacherID" = "teacher"."id"
WHERE 
    "Assignment"."teacherID" = $1 AND  
    "student"."CourseID" = $2 AND
    "student".year = $3 AND
    "student".section = $4
ORDER BY 
    "Subjects"."Year" ASC,
    "Subjects"."Semester" ASC,
    "student"."section" ASC,
    "student"."lastname" ASC,
    "student"."firstname" ASC;`,
      [teacherID, courseID, year, section]
    );
    return rows; 
  } catch (error) {
    throw new Error("Database insert error: " + error.message);
  }
}

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

//post req nalang para mas madali
app.post('/profile', validateToken, async (req,res)=>{
  try{
    const data = await editProfile(req);
    res.send(data);
  }catch(error){
    console.error("error: " + error);
  }
})

async function editProfile(req){
  const {firstname, middlename, lastname, bdate} = req.body;
  const {userID} = req.query;
  const result = await pool.query(`UPDATE "users" SET firstname = $1, middlename = $2, lastname = $3, birthdate = $4 WHERE id = $5`,
  [firstname,middlename,lastname,bdate, userID]);
  console.log(req.body)
  return result
}

app.get('/tsubs', validateToken, async (req,res)=>{
  try{
    const result = await getTSubs(req);
    res.send(result);
  }catch(error){
    res.send("error:" + error);
  }
})

async function getTSubs(req){
  const {userID} = req.query
  try{
    const {rows} = await pool.query(`SELECT DISTINCT "Subjects"."Description", teacher.id AS tID, "Subjects".id, "Subjects"."Code", "Subjects"."Year" FROM "Assignment" 
    JOIN "Subjects" ON "Assignment"."SubjectID" = "Subjects".id
    JOIN teacher ON teacher.id = "Assignment"."teacherID"
    JOIN "users" ON "users".id = teacher."uID" 
    WHERE "teacher"."uID" = $1 
    ORDER BY "Subjects".id;`, [userID])
    return rows;
  }catch(error){
    console.error(error);
  }
} 


app.get('/tsections', validateToken, async (req,res)=>{
  try{
    const result = await getTSections(req);
    res.send(result);
  }catch(error){
    res.send("error:" + error);
  }
})

async function getTSections(req){
  const {userID, subjectCode} = req.query
  try{
    const {rows} = await pool.query(`SELECT DISTINCT ON ("Course".id,"Course"."courseCode","Assignment"."Year","Assignment"."Section","Subjects"."Code")
    "Assignment".id AS "aID","Course".id,"Course"."courseCode","Assignment"."Year","Assignment"."Section","Subjects"."Code"FROM "Assignment" 
    JOIN "Course" ON "Course".id = "Assignment"."CourseID" 
    JOIN "Subjects" ON "Subjects".id = "Assignment"."SubjectID"
    JOIN teacher ON teacher.id = "Assignment"."teacherID" 
    JOIN "users" ON "users".id = teacher."uID"
    WHERE "users".id = $1 AND "Subjects"."Code" = $2
    ORDER BY "Course".id, "Course"."courseCode", "Assignment"."Year", "Assignment"."Section", "Subjects"."Code", "Assignment".id`,
    [userID, subjectCode]);
    return rows;
  }catch(error){
    console.error(error)
  }
} 

app.get('/tstudents', validateToken, async (req,res)=>{
  try{
    const result = await getTStudents(req);
    res.send(result);
  }catch(error){
    res.send("error:" + error);
  }
})

async function getTStudents(req){
  const {aID} = req.query
  try{
    const {rows} = await pool.query(`SELECT DISTINCT student.id AS studID, "Subjects".id As subID, "Subjects"."Code", "Course"."courseCode", "Subjects"."Year", "Assignment"."Section", "student".firstname, "student".middlename, "student".lastname FROM "Subjects"
    JOIN "Course" ON "Course".id = "Subjects"."CourseID"JOIN "Assignment" ON "Assignment"."SubjectID" = "Subjects".id
    JOIN "student" ON "student"."section" = "Assignment"."Section" And student.year = "Assignment"."Year" AND student."CourseID" = "Course".id JOIN "teacher" On teacher.id = "Assignment"."teacherID"
    JOIN "users" ON users.id = teacher."uID"
    WHERE "Assignment".id = $1
    ORDER BY "Subjects"."Year", "Assignment"."Section", student.lastname`,[aID])
    return rows;
  }catch(error){
    console.error(error) 
  }
} 

app.get('/tsgrades', validateToken, async (req,res)=>{
  try{
    const result = await getTSGrades(req);
    res.send(result);
  }catch(error){
    res.send(error);
  }
})

async function getTSGrades(req){
  const {subjectID,section,courseCode,year} = req.query;
  try{
    const {rows} = await pool.query(`SELECT "Grades"."studentID", "Grades"."Grade", "Grades".term FROM "Grades" 
    JOIN student ON student.id = "Grades"."studentID" JOIN "Course" ON "Course".id = student."CourseID"
    WHERE "SubjectID" = $1
    AND student.section = $2
    AND "Course"."courseCode" = $3
    AND student.year = $4`,
    [subjectID, section, courseCode, year])
    return rows;
  }catch(error){
    console.error(error);
  }
} 

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
