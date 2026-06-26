import express from "express";
const { json } = express;
import { createPool } from "mysql2";
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import Groq from 'groq-sdk';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Environment validation on startup
const required = ["JWT_SECRET", "REFRESH_SECRET", "DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "PORT", "GROQ_API_KEY"];
required.forEach(key => {
    if (!process.env[key]) {
        console.error(`Missing required env variable: ${key}`);
        process.exit(1);
    }
});

const SECRET_KEY = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const app = express();

// Input Validation Helpers
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && emailRegex.test(email);
};

const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    return typeof phone === 'string' && phoneRegex.test(phone);
};

const isValidDate = (dateStr) => {
    const timestamp = Date.parse(dateStr);
    return !isNaN(timestamp);
};

// Security + Performance middleware
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rate Limiters
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: { error: "Too many requests, please try again later" }
});

const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_LIMIT_MAX) || 10,
    message: { error: "Too many login attempts, please try again later" }
});

app.use(globalLimiter);

// Health Check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
});

const db = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    timezone: 'Z'
});

// Auto-create all tables on startup
const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        smtp_email VARCHAR(255) DEFAULT NULL,
        smtp_pass VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) DEFAULT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        stage VARCHAR(50) DEFAULT 'Lead',
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meetings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        meeting_date DATETIME NOT NULL,
        notes TEXT DEFAULT NULL,
        outcome VARCHAR(255) DEFAULT NULL,
        attendees TEXT DEFAULT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        reminder_time DATETIME NOT NULL,
        email VARCHAR(255) NOT NULL,
        sent TINYINT DEFAULT 0,
        draft_body TEXT DEFAULT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(500) NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`;

const tables = createTablesSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
let completed = 0;
tables.forEach((sql) => {
    db.query(sql, (err) => {
        if (err) {
            console.error("Table setup error:", err.message);
        } else {
            completed++;
            if (completed === tables.length) {
                console.log("All tables verified/created successfully.");

                // Add indexes after tables are created
                const indexes = [
                    { name: "idx_companies_user_id", sql: "CREATE INDEX idx_companies_user_id ON companies(user_id)" },
                    { name: "idx_meetings_user_id", sql: "CREATE INDEX idx_meetings_user_id ON meetings(user_id)" },
                    { name: "idx_reminders_user_sent", sql: "CREATE INDEX idx_reminders_user_sent ON reminders(user_id, sent)" },
                ];

                indexes.forEach(({ name, sql }) => {
                    db.query(
                        `SELECT COUNT(*) AS count FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name = ?`,
                        [name],
                        (err, result) => {
                            if (err) return console.error("Index check error:", err.message);
                            if (result[0].count === 0) {
                                db.query(sql, (err) => {
                                    if (err) console.error("Index creation error:", err.message);
                                    else console.log(`Index ${name} created successfully`);
                                });
                            }
                        }
                    );
                });
            }
        }
    });
});

const authenticateToken = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = user;
        next();
    });
};

// Auth Routes
app.post("/login", loginLimiter, (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "email and password are required" });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length === 0) return res.status(404).json({ error: "User not found" });

        const user = result[0];
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid password" });

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name || "" },
            SECRET_KEY,
            { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
        );
        const refreshToken = jwt.sign(
            { id: user.id, email: user.email },
            REFRESH_SECRET,
            { expiresIn: process.env.REFRESH_EXPIRES_IN || "7d" }
        );

        db.query(
            "INSERT INTO refresh_tokens (token, user_id) VALUES (?, ?)",
            [refreshToken, user.id],
            (err) => {
                if (err) return res.status(500).json({ error: "Failed to store refresh token" });
                res.json({ message: "Login Successful", token, refreshToken });
            }
        );
    });
});

app.post("/register", (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "name, email, and password are required" });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: "Failed to hash password" });

        db.query(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, hash],
            (err, result) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY" || err.message.includes("Duplicate entry")) {
                        return res.status(400).json({ error: "Email is already registered" });
                    }
                    return res.status(500).json({ error: err.message });
                }
                res.status(201).json({ message: "User registered successfully", userId: result.insertId });
            }
        );
    });
});

app.get("/me", authenticateToken, (req, res) => {
    res.json(req.user);
});

app.post("/token", (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token is required" });
    }

    db.query("SELECT * FROM refresh_tokens WHERE token = ?", [refreshToken], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.length === 0) return res.status(403).json({ error: "Invalid refresh token" });

        jwt.verify(refreshToken, REFRESH_SECRET, (err, user) => {
            if (err) return res.status(403).json({ error: "Invalid or expired refresh token" });

            db.query("SELECT id, name, email FROM users WHERE id = ?", [user.id], (err, userResult) => {
                if (err) return res.status(500).json({ error: err.message });
                if (userResult.length === 0) return res.status(403).json({ error: "User not found" });

                const dbUser = userResult[0];
                const accessToken = jwt.sign(
                    { id: dbUser.id, email: dbUser.email, name: dbUser.name || "" },
                    SECRET_KEY,
                    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
                );
                res.json({ token: accessToken });
            });
        });
    });
});

app.post("/logout", (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
    }

    db.query("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: "Logged out successfully" });
    });
});

// Settings Routes
app.get("/settings", authenticateToken, (req, res) => {
    db.query(
        "SELECT smtp_email FROM users WHERE id = ?",
        [req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.length === 0) return res.status(404).json({ error: "User not found" });
            res.json(result[0]);
        }
    );
});

app.put("/settings", authenticateToken, (req, res) => {
    const { smtp_email, smtp_pass } = req.body;

    if (!smtp_email || !smtp_pass) {
        return res.status(400).json({ error: "smtp_email and smtp_pass are required" });
    }

    if (!isValidEmail(smtp_email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    db.query(
        "UPDATE users SET smtp_email = ?, smtp_pass = ? WHERE id = ?",
        [smtp_email, smtp_pass, req.user.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Settings Updated" });
        }
    );
});

// Cron Job - every 2 minutes, per user smtp
cron.schedule(process.env.CRON_SCHEDULE || "*/2 * * * *", () => {
    const now = new Date();

    db.query(
        `SELECT reminders.*, companies.company_name, users.smtp_email, users.smtp_pass
         FROM reminders
         LEFT JOIN users ON reminders.user_id = users.id
         LEFT JOIN companies ON reminders.company_id = companies.id
         WHERE reminders.reminder_time <= ? AND reminders.sent = 0`,
        [now],
        (err, results) => {
            if (err) return console.log("Cron error:", err.message);
            if (results.length === 0) return;

            results.forEach((reminder) => {
                if (!reminder.smtp_email || !reminder.smtp_pass) {
                    console.log(`No SMTP credentials for reminder ${reminder.id}, skipping.`);
                    return;
                }

                const userTransporter = nodemailer.createTransport({
                    service: process.env.EMAIL_SERVICE || "gmail",
                    auth: {
                        user: reminder.smtp_email,
                        pass: reminder.smtp_pass
                    }
                });

                // Use AI draft body if saved, otherwise fall back to generic message
                const emailBody = reminder.draft_body
                    ? reminder.draft_body
                    : `Hi,\n\nYou have a meeting reminder for ${reminder.company_name || 'your client'}.\nScheduled at: ${new Date(reminder.reminder_time).toLocaleString()}\n\nBest regards,\nYour CRM`;

                // Extract subject from draft (first line if it starts with "Subject:")
                let subject = `CRM Reminder – ${reminder.company_name || 'Meeting'}`;
                let body = emailBody;
                if (emailBody.toLowerCase().startsWith('subject:')) {
                    const lines = emailBody.split('\n');
                    subject = lines[0].replace(/^subject:\s*/i, '').trim();
                    body = lines.slice(1).join('\n').trim();
                }

                const mailOptions = {
                    from: reminder.smtp_email,
                    to: reminder.email,
                    subject,
                    text: body
                };

                userTransporter.sendMail(mailOptions, (err) => {
                    if (err) return console.log("Email error:", err.message);
                    db.query("UPDATE reminders SET sent = 1 WHERE id = ?", [reminder.id]);
                    console.log(`Email sent to: ${reminder.email} | Draft: ${!!reminder.draft_body}`);
                });
            });
        }
    );
});

// Companies CRUD
app.post("/companies", authenticateToken, (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: "Request body is missing." });
    }
    const { company_name, contact_person, email, phone, stage } = req.body;

    if (!company_name || !email) {
        return res.status(400).json({ error: "company_name and email are required" });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    if (phone && !isValidPhone(phone)) {
        return res.status(400).json({ error: "Invalid phone format" });
    }

    db.query(
        "INSERT INTO companies(company_name, contact_person, email, phone, stage, user_id) VALUES(?,?,?,?,?,?)",
        [company_name, contact_person, email, phone, stage || "Lead", req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Company Added", id: result.insertId });
        }
    );
});

app.get("/companies", authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    db.query(
        "SELECT * FROM companies WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
        [req.user.id, limit, offset],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        }
    );
});

app.get("/companies/:id", authenticateToken, (req, res) => {
    db.query(
        "SELECT * FROM companies WHERE id = ? AND user_id = ?",
        [req.params.id, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.length === 0) return res.status(404).json({ error: "Company not found" });
            res.json(result[0]);
        }
    );
});

app.put("/companies/:id", authenticateToken, (req, res) => {
    const fields = [];
    const values = [];

    if (req.body.company_name) { fields.push("company_name=?"); values.push(req.body.company_name); }
    if (req.body.contact_person) { fields.push("contact_person=?"); values.push(req.body.contact_person); }
    if (req.body.email) {
        if (!isValidEmail(req.body.email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        fields.push("email=?");
        values.push(req.body.email);
    }
    if (req.body.phone) {
        if (!isValidPhone(req.body.phone)) {
            return res.status(400).json({ error: "Invalid phone format" });
        }
        fields.push("phone=?");
        values.push(req.body.phone);
    }
    if (req.body.stage) { fields.push("stage=?"); values.push(req.body.stage); }

    if (fields.length === 0) {
        return res.status(400).json({ error: "No fields provided to update" });
    }

    values.push(req.params.id);
    values.push(req.user.id);

    db.query(
        `UPDATE companies SET ${fields.join(", ")} WHERE id=? AND user_id=?`,
        values,
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Company not found" });
            res.json({ message: "Company Updated" });
        }
    );
});

app.patch("/companies/:id/stage", authenticateToken, (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: "Request body is missing." });
    }
    const { stage } = req.body;

    const validStages = ["Lead", "Meeting Scheduled", "Proposal Sent", "In Progress", "Closed Won", "Closed Lost"];
    if (!validStages.includes(stage)) {
        return res.status(400).json({ error: "Invalid stage value" });
    }

    db.query(
        "UPDATE companies SET stage=? WHERE id=? AND user_id=?",
        [stage, req.params.id, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Company not found" });
            res.json({ message: "Stage Updated" });
        }
    );
});

app.delete("/companies/:id", authenticateToken, (req, res) => {
    db.query(
        "DELETE FROM companies WHERE id=? AND user_id=?",
        [req.params.id, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Company not found" });
            res.json({ message: "Company Deleted" });
        }
    );
});

// Meetings CRUD
app.post("/meetings", authenticateToken, (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: "Request body is missing." });
    }
    const { company_id, meeting_date, notes, outcome, attendees } = req.body;

    if (!company_id || !meeting_date) {
        return res.status(400).json({ error: "company_id and meeting_date are required" });
    }

    if (!isValidDate(meeting_date)) {
        return res.status(400).json({ error: "Invalid meeting_date format." });
    }

    db.query(
        "INSERT INTO meetings(company_id, meeting_date, notes, outcome, attendees, user_id) VALUES(?,?,?,?,?,?)",
        [company_id, new Date(meeting_date), notes, outcome, attendees, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Meeting Added", id: result.insertId });
        }
    );
});

app.get("/meetings", authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    db.query(
        `SELECT meetings.*, companies.company_name, companies.contact_person 
         FROM meetings 
         LEFT JOIN companies ON meetings.company_id = companies.id 
         WHERE meetings.user_id = ?
         ORDER BY meeting_date ASC
         LIMIT ? OFFSET ?`,
        [req.user.id, limit, offset],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        }
    );
});

app.get("/meetings/:id", authenticateToken, (req, res) => {
    db.query(
        `SELECT meetings.*, companies.company_name, companies.contact_person 
         FROM meetings 
         LEFT JOIN companies ON meetings.company_id = companies.id 
         WHERE meetings.id = ? AND meetings.user_id = ?`,
        [req.params.id, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.length === 0) return res.status(404).json({ error: "Meeting not found" });
            res.json(result[0]);
        }
    );
});

app.get("/companies/:id/meetings", authenticateToken, (req, res) => {
    db.query(
        "SELECT * FROM meetings WHERE company_id = ? AND user_id = ? ORDER BY meeting_date ASC",
        [req.params.id, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        }
    );
});

app.put("/meetings/:id", authenticateToken, (req, res) => {
    const fields = [];
    const values = [];

    if (req.body.meeting_date) {
        if (!isValidDate(req.body.meeting_date)) {
            return res.status(400).json({ error: "Invalid meeting_date format." });
        }
        fields.push("meeting_date=?");
        values.push(new Date(req.body.meeting_date));
    }
    if (req.body.notes) { fields.push("notes=?"); values.push(req.body.notes); }
    if (req.body.outcome) { fields.push("outcome=?"); values.push(req.body.outcome); }
    if (req.body.attendees) { fields.push("attendees=?"); values.push(req.body.attendees); }
    if (req.body.attendees === '') { fields.push("attendees=?"); values.push(''); }

    if (fields.length === 0) {
        return res.status(400).json({ error: "No fields provided to update" });
    }

    values.push(req.params.id);
    values.push(req.user.id);

    db.query(
        `UPDATE meetings SET ${fields.join(", ")} WHERE id=? AND user_id=?`,
        values,
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Meeting not found" });

            if (req.body.send_reschedule_email && req.body.meeting_date) {
                db.query(
                    `SELECT users.smtp_email, users.smtp_pass, companies.email AS company_email, companies.company_name 
                     FROM users 
                     JOIN meetings ON meetings.user_id = users.id
                     JOIN companies ON meetings.company_id = companies.id
                     WHERE meetings.id = ? AND users.id = ?`,
                    [req.params.id, req.user.id],
                    (err, results) => {
                        if (!err && results.length > 0) {
                            const info = results[0];
                            if (info.smtp_email && info.smtp_pass && info.company_email) {
                                const userTransporter = nodemailer.createTransport({
                                    service: process.env.EMAIL_SERVICE || "gmail",
                                    auth: { user: info.smtp_email, pass: info.smtp_pass }
                                });
                                const formattedDate = new Date(req.body.meeting_date).toLocaleString();
                                const mailOptions = {
                                    from: info.smtp_email,
                                    to: info.company_email,
                                    subject: "Meeting Rescheduled",
                                    text: `Hello,\n\nYour meeting has been rescheduled to ${formattedDate}.\n\nBest regards,\n${info.company_name}`
                                };
                                userTransporter.sendMail(mailOptions, (err) => {
                                    if (err) console.log("Reschedule email error:", err.message);
                                    else console.log("Reschedule email sent to:", info.company_email);
                                });
                            }
                        }
                    }
                );
            }

            if (req.body.company_id && req.body.meeting_date) {
                db.query(
                    "UPDATE reminders SET reminder_time = ? WHERE company_id = ? AND user_id = ? AND sent = 0",
                    [new Date(req.body.meeting_date), req.body.company_id, req.user.id],
                    (err) => {
                        if (err) console.log("Failed to sync reminder:", err.message);
                    }
                );
            }

            res.json({ message: "Meeting Updated" });
        }
    );
});

app.delete("/meetings/:id", authenticateToken, (req, res) => {
    db.query(
        "DELETE FROM meetings WHERE id=? AND user_id=?",
        [req.params.id, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Meeting not found" });
            res.json({ message: "Meeting Deleted" });
        }
    );
});

// Reminders CRUD
app.post("/reminders", authenticateToken, (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: "Request body is missing." });
    }
    const { company_id, reminder_time, email, draft_body } = req.body;

    if (!company_id || !reminder_time || !email) {
        return res.status(400).json({ error: "company_id, reminder_time and email are required" });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    if (!isValidDate(reminder_time)) {
        return res.status(400).json({ error: "Invalid reminder_time format." });
    }

    db.query(
        "INSERT INTO reminders(company_id, reminder_time, email, sent, draft_body, user_id) VALUES(?,?,?,?,?,?)",
        [company_id, new Date(reminder_time), email, 0, draft_body || null, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Reminder Added", id: result.insertId });
        }
    );
});

app.get("/reminders", authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    db.query(
        `SELECT reminders.*, companies.company_name 
         FROM reminders 
         LEFT JOIN companies ON reminders.company_id = companies.id 
         WHERE reminders.user_id = ?
         ORDER BY reminder_time ASC
         LIMIT ? OFFSET ?`,
        [req.user.id, limit, offset],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        }
    );
});

app.get("/reminders/:id", authenticateToken, (req, res) => {
    db.query(
        "SELECT * FROM reminders WHERE id = ? AND user_id = ?",
        [req.params.id, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.length === 0) return res.status(404).json({ error: "Reminder not found" });
            res.json(result[0]);
        }
    );
});

app.put("/reminders/:id", authenticateToken, (req, res) => {
    const fields = [];
    const values = [];

    if (req.body.reminder_time) {
        if (!isValidDate(req.body.reminder_time)) {
            return res.status(400).json({ error: "Invalid reminder_time format." });
        }
        fields.push("reminder_time=?");
        values.push(new Date(req.body.reminder_time));
    }
    if (req.body.email) {
        if (!isValidEmail(req.body.email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        fields.push("email=?");
        values.push(req.body.email);
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: "No fields provided to update" });
    }

    fields.push("sent=?");
    values.push(0);
    values.push(req.params.id);
    values.push(req.user.id);

    db.query(
        `UPDATE reminders SET ${fields.join(", ")} WHERE id=? AND user_id=?`,
        values,
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Reminder not found" });
            res.json({ message: "Reminder Updated" });
        }
    );
});

app.delete("/reminders/:id", authenticateToken, (req, res) => {
    db.query(
        "DELETE FROM reminders WHERE id=? AND user_id=?",
        [req.params.id, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: "Reminder not found" });
            res.json({ message: "Reminder Deleted" });
        }
    );
});

// AI Routes
app.post("/ai/summarize", authenticateToken, async (req, res) => {
    const { notes } = req.body;
    if (!notes) return res.status(400).json({ error: "Notes are required" });

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a professional assistant. Please summarize the following meeting notes and provide a clear bulleted list of Action Items. Keep it concise."
                },
                {
                    role: "user",
                    content: notes
                }
            ],
            model: process.env.GROQ_MODEL || "llama-3.1-8b-instant"
        });

        res.json({ summary: chatCompletion.choices[0]?.message?.content || "" });
    } catch (error) {
        console.error("Groq Error:", error);
        res.status(500).json({ error: "Failed to summarize notes." });
    }
});

app.post("/ai/draft-email", authenticateToken, async (req, res) => {
    const { company_id, tone } = req.body;
    if (!company_id) return res.status(400).json({ error: "company_id is required" });

    // Fetch company info + last 5 meetings
    db.query(
        `SELECT company_name, contact_person, email FROM companies WHERE id = ? AND user_id = ?`,
        [company_id, req.user.id],
        (err, companyResult) => {
            if (err || companyResult.length === 0)
                return res.status(404).json({ error: "Company not found" });

            const company = companyResult[0];

            db.query(
                `SELECT notes, outcome, meeting_date FROM meetings WHERE company_id = ? AND user_id = ? ORDER BY meeting_date DESC LIMIT 5`,
                [company_id, req.user.id],
                async (err, meetings) => {
                    if (err) return res.status(500).json({ error: err.message });

                    let meetingContext = "No meeting history available.";
                    if (meetings.length > 0) {
                        meetingContext = meetings.map((m, i) => {
                            let notes = "";
                            try {
                                const parsed = JSON.parse(m.notes);
                                notes = Array.isArray(parsed) ? parsed.join(" | ") : m.notes;
                            } catch { notes = m.notes || ""; }
                            const date = new Date(m.meeting_date).toLocaleDateString();
                            return `Meeting ${i + 1} (${date}): Notes: ${notes}. Outcome: ${m.outcome || "N/A"}`;
                        }).join("\n");
                    }

                    const selectedTone = tone || "professional";
                    const senderName = req.user.name || "The Team";
                    const prompt = `You are a business communication expert. Draft a concise, ${selectedTone} follow-up email to ${company.contact_person || "the client"} at ${company.company_name}.

Recent meeting history:
${meetingContext}

Guidelines:
- Keep it under 200 words
- Reference the most recent interaction naturally
- End with a clear next step or call-to-action
- Use a ${selectedTone} tone
- Sign off the email with the name: ${senderName}
- Output only the email body (Subject line + body). Do not include any extra explanation.`;

                    try {
                        const chatCompletion = await groq.chat.completions.create({
                            messages: [{ role: "user", content: prompt }],
                            model: process.env.GROQ_MODEL || "llama-3.1-8b-instant"
                        });
                        res.json({ draft: chatCompletion.choices[0]?.message?.content || "" });
                    } catch (error) {
                        console.error("Groq Draft Error:", error);
                        res.status(500).json({ error: "Failed to draft email." });
                    }
                }
            );
        }
    );
});

app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.message);
    res.status(500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Running on Port ${PORT}`);
});

process.on("SIGINT", () => {
    db.end((err) => {
        if (err) console.log(err);
        else console.log("Database Pool Closed");
        process.exit();
    });
});