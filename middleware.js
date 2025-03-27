const express = require('express');
const app = express();
const dotenv = require('dotenv')
dotenv.config();


async function validateToken(req, res, next) {
    const accessToken = req.headers.authorization;
    console.log("Received Token:", accessToken);

    if (!accessToken) {
        return res.status(400).json({ error: "No token" });
    }

    if (accessToken === process.env.ACCESS_TOKEN) {
        console.log("✅ Token validated successfully.");
        return next(); 
    }

    return res.status(401).json({ error: "Invalid access token" }); 
}


module.exports = validateToken