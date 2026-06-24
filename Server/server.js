import express from "express";
const { json } = express;
import { createPool } from "mysql2";
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

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

app.use(json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const db = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verify connection and ensure refresh_tokens table exists on startup
db.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(500) NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error("Database connection or table setup failed:", err.message);
    } else {
        console.log("MySQL Pool connected. refresh_tokens table verified.");
    }
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
app.post("/login", (req, res) => {
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
            { expiresIn: "15m" }
        );
        const refreshToken = jwt.sign(
            { id: user.id, email: user.email },
            REFRESH_SECRET,
            { expiresIn: "7d" }
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
                    { expiresIn: "15m" }
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

// Cron Job - per user smtp
cron.schedule("* * * * *", () => {
    const now = new Date();

    db.query(
        `SELECT reminders.*, users.smtp_email, users.smtp_pass 
         FROM reminders 
         LEFT JOIN users ON reminders.user_id = users.id 
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
                    service: "gmail",
                    auth: {
                        user: reminder.smtp_email,
                        pass: reminder.smtp_pass
                    }
                });

                const mailOptions = {
                    from: reminder.smtp_email,
                    to: reminder.email,
                    subject: "CRM Meeting Reminder",
                    text: `Hi, you have a meeting reminder. Company ID: ${reminder.company_id}. Scheduled at: ${reminder.reminder_time}`
                };

                userTransporter.sendMail(mailOptions, (err) => {
                    if (err) return console.log("Email error:", err.message);
                    db.query("UPDATE reminders SET sent = 1 WHERE id = ?", [reminder.id]);
                    console.log("Email sent to:", reminder.email);
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
    db.query(
        "SELECT * FROM companies WHERE user_id = ? ORDER BY id DESC",
        [req.user.id],
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
        [company_id, meeting_date, notes, outcome, attendees, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Meeting Added", id: result.insertId });
        }
    );
});

app.get("/meetings", authenticateToken, (req, res) => {
    db.query(
        `SELECT meetings.*, companies.company_name, companies.contact_person 
         FROM meetings 
         LEFT JOIN companies ON meetings.company_id = companies.id 
         WHERE meetings.user_id = ?
         ORDER BY meeting_date ASC`,
        [req.user.id],
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
        values.push(req.body.meeting_date);
    }
    if (req.body.notes) { fields.push("notes=?"); values.push(req.body.notes); }
    if (req.body.outcome) { fields.push("outcome=?"); values.push(req.body.outcome); }
    if (req.body.attendees) { fields.push("attendees=?"); values.push(req.body.attendees); }
    if (req.body.attendees === '') { fields.push("attendees=?"); values.push(''); } // Allow clearing

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

            // If flag is set, send a notification email
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
                                    service: "gmail",
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

            // Sync with reminders table if applicable
            if (req.body.company_id && req.body.meeting_date) {
                db.query(
                    "UPDATE reminders SET reminder_time = ? WHERE company_id = ? AND user_id = ? AND sent = 0",
                    [req.body.meeting_date, req.body.company_id, req.user.id],
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
    const { company_id, reminder_time, email } = req.body;

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
        "INSERT INTO reminders(company_id, reminder_time, email, sent, user_id) VALUES(?,?,?,?,?)",
        [company_id, reminder_time, email, 0, req.user.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: "Reminder Added", id: result.insertId });
        }
    );
});

app.get("/reminders", authenticateToken, (req, res) => {
    db.query(
        `SELECT reminders.*, companies.company_name 
         FROM reminders 
         LEFT JOIN companies ON reminders.company_id = companies.id 
         WHERE reminders.user_id = ?
         ORDER BY reminder_time ASC`,
        [req.user.id],
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
        values.push(req.body.reminder_time);
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

app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.message);
    res.status(500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server Running on Port ${PORT}`);
});

process.on("SIGINT", () => {
    db.end((err) => {
        if (err) console.log(err);
        else console.log("Database Pool Closed");
        process.exit();
    });
});