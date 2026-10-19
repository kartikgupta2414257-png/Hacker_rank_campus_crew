# HackerRank Campus Crew — Amrapali University, Haldwani

Official technology portal and student coordinator recruitment website for **HackerRank Campus Crew** at **Amrapali University, Haldwani**.

---

## 🌟 Overview & Key Features

- **Professional Black & Neon-Green Coding Theme**: HackerRank dark aesthetic with glowing accents, glassmorphic cards, and responsive typography (`Inter` & `JetBrains Mono`).
- **Student Coordinator Recruitment (12 Positions Quota)**:
  - Real-time seat tracking meter (12 Positions Quota).
  - Validated application form capturing: Full Name, Email, Mobile (10 digits), Course, Department, Year, Semester, College Name, Technical Skills (Interactive tag picker), Previous Experience, Statement of Purpose ("Why join?"), and Privacy Consent.
  - Automatic duplicate check and Application ID generation (`APP-AU-2026-XXX`).
  - Automatic Email Dispatch upon submission with official template from **Campus Ambassador Anil Pandey**.
- **Hackathons & Team Competitions**:
  - Filterable by Status (*Upcoming, Ongoing, Completed*) and Mode (*Online, Offline, Hybrid*).
  - Displays dates, registration deadlines, prizes, team size, themes, and direct links.
- **Coding Contests & Problem Solving**:
  - Collegiate & national contests hosted on HackerRank.
  - Filterable by difficulty (*Beginner, Intermediate, Advanced*) and level (*College-Level, National-Level*).
- **Quick Contests & Interactive Quiz Engine**:
  - **Daily Code Bites**: Output prediction in C++, Python scope quirks, SQL clauses, and debugging challenges with instant interactive choice validation and explanations.
  - **Live 5-Question Campus Crew Quiz**: Interactive mini-contest with real-time scoring, live points tally, and performance evaluation.
- **Courses & Skill Development**:
  - 10+ core categories: C/C++, Java, Python, DSA, Web Dev, AI/ML, Cybersecurity, DBMS/SQL, Competitive Programming, and Campus Placement Aptitude.
  - Level badges, skills covered, provider tags, and 100% verified free links.
- **Workshops, Webinars & Tech Events**:
  - Hands-on Git & GitHub, FAANG preparation, Full-Stack bootcamps, and technical quizzes.
- **Internships & Verified Opportunities**:
  - Google Summer of Code, Microsoft Student Ambassador, DRDO Research Internship, and GitHub Campus Experts.
- **Administrator Dashboard (Password Protected)**:
  - Default Admin Password: `amrapali2026`
  - Review all candidate applications with live status switching (*Pending, Shortlisted, Selected, Rejected*).
  - Live quota tracking (Tracks selected candidates out of 12).
  - Candidate details inspector modal.
  - **One-Click CSV Export**: Download all applications with full candidate details.
  - **Email Outbox Log**: Full record of all automated confirmation emails dispatched.
  - Add & publish new hackathons, contests, events, and announcements.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

### 2. Installation & Run
```bash
# Navigate to the project directory
cd "d:\cpp coding\Hacker rank campus crew"

# Install dependencies (already installed)
npm install

# Start the application server
npm start
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🔑 Administrative Access

- Go to `#admin` or click **Admin** in the top navigation bar.
- **Default Password**: `amrapali2026`
- Configurable via `.env` file under `ADMIN_PASSWORD`.

---

## 📧 Email Configuration (SMTP)

By default, the server runs in **Simulated Outbox Mode** (logs every email to the persistent database and displays them in the Admin Dashboard Outbox table for verification).

To enable live transactional email delivery to real student inboxes, edit `.env`:

```env
PORT=3000
ADMIN_PASSWORD=amrapali2026

# Gmail or SMTP provider settings. For Gmail, use an App Password:
# https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=your_email@gmail.com
```

---

## 🏢 Campus Leadership & Contact

- **Campus Ambassador**: Anil Pandey
- **Institution**: Amrapali University, Haldwani
- **Phone**: `7900546102`
- **College Email**: `au-250303050423@amrapali.ac.in`
- **Alternate Email**: `ap967143@gmail.com`
- **Campus Address**: Shiksha Nagar, Lamachaur, Haldwani, Uttarakhand 263139

---

## 🌐 Public Cloud Deployment (Free Tier)

This application is ready to deploy on **Render**, **Railway**, **Vercel**, or **Glitch**:

### Deploy on Render:
1. Push this folder to a GitHub repository.
2. In Render dashboard, select **New Web Service**.
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Add Environment Variables: `PORT=3000`, `ADMIN_PASSWORD=your_secure_password`.
