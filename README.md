# Client Tracker CRM

A modern, responsive, and secure **Client Relationship Management (CRM)** application designed to track prospective client companies, manage meeting records with attendees and outcome notes, configure personal email alerts, and receive automated meeting reminders.

---

## 🚀 Key Features

- **Interactive Dashboard**: Get visual summaries of CRM analytics (total active companies, pending meetings, automated reminder statistics).
- **Client & Company Management**: Track clients across pipeline stages (*Lead, Meeting Scheduled, Proposal Sent, In Progress, Closed Won, Closed Lost*).
- **Meeting Scheduler**: Log meeting schedules, record detailed discussion logs, manage multiple attendees, and reschedule meetings with client email alerts.
- **Background Mail Reminders**: Automated background task processor (via `node-cron`) that automatically dispatches SMTP email alerts (via `nodemailer`) using the user's custom SMTP settings.
- **Secure Authentication**: Built with stateless JSON Web Tokens (JWT) using short-lived access tokens and stored refresh tokens for secure automatic login.
- **Glassmorphism Theme**: Sleek UI designed with a slate-900 navigation drawer, responsive data tables, responsive layouts, and interactive modals.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Axios
- **Backend**: Node.js, Express.js, JWT, Node-Cron, Nodemailer
- **Database**: MySQL

---

## 📦 Project Directory Structure

```text
Client Tracker/
├── Client/                 # React Frontend Application
│   ├── src/
│   │   ├── views/          # Views: Dashboard, Companies, Meetings, Reminders, Settings, Auth
│   │   ├── api.js          # API Client with Token Refresh Interceptor
│   │   └── main.jsx        # App Entrypoint
│   └── package.json
└── Server/                 # Node.js Express Backend API
    ├── server.js           # Express App & Background Cron Scheduler
    └── package.json
```

---

## 💾 Database Schema Setup

Before launching the backend, connect to your MySQL database instance and execute the following SQL script to create the necessary tables:

```sql
CREATE DATABASE IF NOT EXISTS crm;
USE crm;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    smtp_email VARCHAR(255) DEFAULT NULL,
    smtp_pass VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Companies Table
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

-- 3. Meetings Table
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

-- 4. Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    reminder_time DATETIME NOT NULL,
    email VARCHAR(255) NOT NULL,
    sent TINYINT DEFAULT 0,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Refresh Tokens Table (Verifies automatically on server launch)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(500) NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## ⚙️ Environment Configuration

Set up configuration files in both the `Client` and `Server` directories.

### Backend Config (`Server/.env`)
Create a `.env` file in the `/Server` folder:
```env
PORT=3000
JWT_SECRET="your_jwt_access_secret_key"
REFRESH_SECRET="your_jwt_refresh_secret_key"

# Database Configuration
DB_HOST="localhost"
DB_USER="your_database_username"
DB_PASSWORD="your_database_password"
DB_NAME="crm"
DB_PORT=3306
```

### Frontend Config (`Client/.env`)
Create a `.env` file in the `/Client` folder:
```env
VITE_API_URL="http://localhost:3000"
```

---

## 🏁 How to Run Locally

### 1. Start the Backend Server
```bash
cd Server
npm install
node server.js
```
The server will boot and run on `http://localhost:3000` (or the `PORT` specified in your `.env`).

### 2. Start the Frontend Dev Server
```bash
cd Client
npm install
npm run dev
```
Open the local URL output by Vite in your browser (typically `http://localhost:5173`).

---

## 📡 API Reference Sheet

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/register` | Registers a new user account | No |
| **POST** | `/login` | Authenticates user and returns JWT + Refresh tokens | No |
| **POST** | `/token` | Returns new short-lived access token using refresh token | No |
| **POST** | `/logout` | Invalidates and deletes the stored refresh token | Yes |
| **GET** | `/me` | Returns current user details | Yes |
| **GET** | `/companies` | Fetches all companies assigned to the user | Yes |
| **POST** | `/companies` | Adds a new company record | Yes |
| **PUT** | `/companies/:id` | Updates specific details of a company | Yes |
| **DELETE** | `/companies/:id` | Deletes a company record | Yes |
| **GET** | `/meetings` | Fetches logged meetings | Yes |
| **POST** | `/meetings` | Creates a new meeting record | Yes |
| **PUT** | `/meetings/:id` | Reschedules/updates a meeting | Yes |
| **GET** | `/reminders` | Fetches active reminder alerts | Yes |
| **POST** | `/reminders` | Configures a new email reminder task | Yes |
| **GET** | `/settings` | Fetches the user SMTP settings | Yes |
| **PUT** | `/settings` | Updates the user SMTP settings | Yes |
