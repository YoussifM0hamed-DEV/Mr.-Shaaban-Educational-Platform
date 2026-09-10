# Mr. Shaaban Educational Platform

A single-teacher learning platform. The whole site belongs to one teacher, who owns the
curriculum, approves every student, runs live classes, and can see exactly what each
student actually studied.

There is no teacher selection, no marketplace and no multi-tenancy anywhere in the code
or the database.

**Stack:** React + Vite + Tailwind CSS on the front end, Express + Mongoose + MongoDB on
the back end, JWT in an httpOnly cookie for auth, bcrypt for passwords, Socket.IO for
real-time notifications, Cloudinary for materials and images.

Lesson videos are **linked, not uploaded**. The teacher hosts each video on YouTube or
any host that serves a direct video file, and the platform stores only the link. That
keeps video storage and bandwidth costs off the platform entirely, while watch tracking
still works because both sources report a real playback position.

---

## Getting started

### 1. Requirements

- Node.js 18 or newer
- A MongoDB database (local `mongod`, or a MongoDB Atlas connection string)

### 2. Install

```bash
npm run install:all
```

### 3. Configure

```bash
cp server/.env.example server/.env
```

Then edit `server/.env`. The values you must set before running:

| Variable | What it is |
| --- | --- |
| `MONGODB_URI` | Your MongoDB connection string |
| `JWT_SECRET` | A long random string used to sign sessions |
| `COOKIE_SECRET` | A second long random string |
| `TEACHER_EMAIL` / `TEACHER_PASSWORD` | The owner account created by the seed |
| `SMTP_USER` / `SMTP_PASS` | Sends password reset emails. See Forgotten passwords below |

Cloudinary stores materials and images only, and is optional in development. Without it,
material uploads fall back to `server/uploads` on local disk and everything else works
unchanged. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`
to switch to cloud storage. The secret never leaves the server.

No Cloudinary quota is spent on video, because videos are never uploaded here.

### 4. Create the teacher account

```bash
npm run seed
```

To also load a realistic demo cohort (one assistant, twelve students, three modules with
videos, materials and quizzes, an exam, four live classes and a spread of recorded
activity):

```bash
npm run seed:demo
```

The seed prints the sign-in details when it finishes.

### 5. Run

```bash
npm run dev
```

The API listens on `http://localhost:5000` and the app on `http://localhost:5173`. Vite
proxies `/api`, `/uploads` and the websocket to the API, so the browser stays on one
origin and the auth cookie is first-party.

### 6. Build for production

```bash
npm run build
```

With `NODE_ENV=production`, the Express server serves the built client from
`client/dist`, so a single process runs the whole platform.

---

## The three roles

**Teacher** owns the platform. One teacher account exists, created by the seed. They hold
every permission implicitly.

**Assistant** accounts are created by the teacher and hold only the permissions the
teacher grants. Permissions are read fresh from the database on every request, so
revoking one takes effect immediately without the assistant signing out.

**Student** accounts are created by public registration. A new registration is `PENDING`
and reaches no lesson, video, material, quiz, exam or meeting until the teacher approves
it.

---

## Groups

A group is a named set of students, the way a teacher thinks about their week: "Grade 3
Saturday 5pm". Groups do two jobs.

**They decide who sees what.** A module can be given to one or more groups, and then only
members of those groups can open it. Everything inside the module inherits that rule: its
lessons, videos, materials, quizzes and its exam. A module with no group at all stays open
to every approved student, so a teacher with a single class never has to think about
groups.

**They fill an invite list in one click.** A live class can be invited by group, by
hand-picked students, or both. Groups are flattened to their members when the class is
saved, so the guest list of a past class stays exactly as it was on the day, even if the
group changes later.

Two consequences worth knowing, because they are what make the numbers trustworthy:

- Progress is measured against each student's own curriculum. A Grade 2 student is never
  diluted by Grade 3 modules they cannot open.
- Every percentage on the dashboard and in the lesson analytics is divided by the students
  who could actually access that content, not by everyone on the platform.
- New content notifies only the students who can see it.

Access is decided in one place, `accessService`, and enforced on every student-facing read:
the module list, a single module, a lesson, a video and its progress pings, a material's
open endpoint, a quiz, and an exam. A student asking for another group's content gets the
same "not found" as for content that does not exist, so a curriculum cannot be discovered
by guessing ids.

---

## How progress is measured

Progress is derived from tracked events, never self-reported.

**Video.** The player counts only the seconds that actually played and sends that delta
to the server every ten seconds, on pause, and when the tab is hidden. Scrubbing to the
end contributes nothing, so a video cannot be completed without watching it. A video is
complete at `VIDEO_COMPLETION_THRESHOLD` percent, 90 by default. The last position is
stored so the student resumes where they stopped.

This works identically for both sources. A direct file plays in the platform own player,
and a YouTube video plays in YouTube own embed while the page polls its real playback
position. Both feed the same tracking hook and the same API, so progress from a YouTube
lesson and a self-hosted lesson mean exactly the same thing.

**Material.** The file URL is only handed out by the open endpoint, which records the
access first. So "opened" always means opened.

**Quiz and exam.** Questions reach the browser with the answer key stripped. Grading
happens entirely on the server against the stored key, and the time limit is enforced
from the attempt's stored expiry rather than the browser clock.

**Live attendance.** Joining is the only way to receive the meeting URL, and the server
checks the student is approved and on the invite list first. A student counts as attended
once they stay for 30 percent of the meeting, capped at five minutes.

**Lesson progress** weights video at 50 percent, materials at 20 and the quiz at 30,
ignoring any component a lesson does not have. Module progress averages its lessons, and
overall progress averages every published lesson.

**Engagement** is `INACTIVE` after `INACTIVE_DAYS_THRESHOLD` days with no tracked
activity, `AT_RISK` after `AT_RISK_DAYS_THRESHOLD` quiet days or below 30 percent
completion, otherwise `ACTIVE`.

---

## Project layout

```
server/
  server.js                 entry point, HTTP server, socket, meeting scheduler
  src/
    config/                 env, database, Cloudinary, shared constants
    models/                 16 Mongoose models
    controllers/            request handling
    services/               progress, analytics, grading, meetings, activity, notifications
    routes/                 REST endpoints
    middleware/             auth, permissions, validation, uploads, rate limits, errors
    validators/             Zod request schemas
    sockets/                Socket.IO server and emit helpers
    utils/                  seed script, tokens, pagination, responses, errors

client/
  src/
    pages/                  screens, grouped by role
    layouts/                the teacher, assistant and student shells
    components/ui/          the reusable component library
    components/shared/      video players, question editor, activity timeline, stat cards
    components/layout/      sidebar, topbar, notification centre
    context/                auth provider
    services/               axios client, endpoint wrappers, socket client
    routes/                 route table and guards
    hooks/, utils/          helpers
```

---

## Security

- Passwords are hashed with bcrypt at 12 rounds and never selected by default.
- The JWT carries only a user id. Role, status and permissions are re-read from the
  database on every request, so nothing about identity comes from the client.
- Sessions live in an httpOnly cookie, `secure` and `SameSite=None` in production.
- Every request body, query and route parameter is validated with Zod, and the parsed
  result replaces the raw input so controllers only see whitelisted values.
- `express-mongo-sanitize` strips operator injection, Helmet sets security headers, and
  CORS is locked to `CLIENT_URL` with credentials.
- Rate limits protect sign-in, registration, uploads and tracking separately.
- Deletes are soft, so a removed student's recorded activity still supports the reports.
- Errors go through one handler that never leaks stack traces in production.

---

## API

All routes are under `/api`.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/platform`, `PATCH /auth/password`, `PATCH /auth/profile` |
| Password reset | `POST /auth/forgot-password`, `GET /auth/reset-password/:token`, `POST /auth/reset-password` |
| Assistants | `GET/POST /assistants`, `GET/PUT/DELETE /assistants/:id`, `PATCH /assistants/:id/status`, `GET /assistants/permissions` |
| Groups | `GET/POST /groups`, `GET/PUT/DELETE /groups/:id`, `PATCH /groups/:id/students` |
| Students | `GET /students`, `GET /students/pending`, `GET /students/:id`, `GET /students/:id/activity`, `GET /students/:id/progress`, `PATCH /students/:id/review`, `PATCH /students/bulk-review`, `PUT/DELETE /students/:id`, `GET /students/stats/summary`, `GET /students/options/approved` |
| Modules | `GET/POST /modules`, `GET/PUT/DELETE /modules/:id`, `PATCH /modules/:id/publish`, `PATCH /modules/reorder` |
| Lessons | `GET/POST /lessons`, `GET/PUT/DELETE /lessons/:id`, `PATCH /lessons/:id/publish`, `PATCH /lessons/reorder` |
| Videos | `POST /lessons/:lessonId/video` (link, JSON not multipart), `PATCH/DELETE /videos/:id`, `POST /videos/:id/start`, `GET/PATCH /videos/:id/progress`, `GET /videos/:id/watchers` |
| Materials | `GET/POST /lessons/:lessonId/materials`, `PATCH/DELETE /materials/:id`, `POST /materials/:id/open`, `GET /materials/:id/access` |
| Quizzes | `GET/POST /quizzes`, `GET/PUT/DELETE /quizzes/:id`, `PATCH /quizzes/:id/publish`, `POST /quizzes/:id/start`, `GET /quizzes/:id/my-attempts`, `GET /quizzes/:id/results`, `POST /quiz-attempts/:attemptId/submit` |
| Exams | `GET/POST /exams`, `GET/PUT/DELETE /exams/:id`, `PATCH /exams/:id/publish`, `POST /exams/:id/start`, `GET /exams/:id/results`, `POST /exam-attempts/:attemptId/submit` |
| Meetings | `GET/POST /meetings`, `GET/PUT/DELETE /meetings/:id`, `PATCH /meetings/:id/cancel`, `POST /meetings/:id/join`, `POST /meetings/:id/leave`, `POST /meetings/:id/finalize`, `GET /meetings/:id/attendance` |
| Analytics | `GET /analytics/dashboard`, `/students-needing-attention`, `/lessons`, `/lessons/:id`, `/meetings`, `/activity-trend`, `GET /activities` |
| Student self | `GET /student/dashboard`, `GET /student/activity`, `GET /progress/me` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `DELETE /notifications/:id` |
| Announcements | `GET/POST /announcements`, `PUT/DELETE /announcements/:id` |

Every list endpoint paginates on the server and returns
`{ success, data, pagination }`. Everything else returns `{ success, message, data }`.

---

## Real-time

Socket.IO authenticates from the same cookie and puts each connection in a room for its
user and its role. It carries new notifications and unread counts, the "live now" push
when a class starts, student-joined events on the attendance screen, quiz and exam
completions, and new registrations.

Every screen also works when the socket is down. Sockets only remove the need to refresh.

A one-minute sweep on the server flips meeting statuses, sends the fifteen-minute
reminder and the live push, and closes attendance when a class ends.

## Meeting providers

The meeting system stores a provider, a join URL, an optional external id and an optional
passcode. Zoom, Microsoft Teams, Skype, Google Meet or anything else that gives you a
join URL all work the same way, and no provider SDK is required.

---

## Lesson videos

Videos are linked, never uploaded, so this platform pays for no video storage or
bandwidth. Two kinds of link are accepted, because these are the two the player can
honestly measure:

- **YouTube** in any of its usual link shapes: `watch?v=`, `youtu.be/`, `/embed/`,
  `/shorts/`, with or without extra parameters.
- **A direct video file** whose URL ends in `.mp4`, `.webm`, `.ogg`, `.mov` or `.m3u8`,
  from any host.

Anything else is refused with an explanation, both in the browser as the teacher types
and again on the server. A Google Drive or Vimeo page link is rejected on purpose: the
player cannot read a real playback position from them, so every student would silently
sit at zero percent forever, which is worse than refusing the link.

To publish a lesson video, upload it to YouTube (unlisted works well), copy the link, and
paste it into the lesson's video panel.

---

## Forgotten passwords

A student who forgets their password recovers it themselves. They open the sign-in page,
follow **Forgot your password?**, enter their email, and receive a link that lets them
choose a new one.

To switch email sending on, put SMTP credentials in `server/.env`. With Gmail, create an
[App Password](https://myaccount.google.com/apppasswords) on the teacher account and use it
as `SMTP_PASS` (a normal Gmail password will not work). Gmail allows roughly 500 messages a
day, which is far more than password resets need.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your.address@gmail.com
SMTP_PASS=the16characterapppassword
```

Until those are set, the flow still works end to end but the link is written to the server
console instead of being emailed, and the student is told that sending is off. That makes
the feature testable in development without credentials.

How the tokens are handled:

- The link carries 32 random bytes. Only its SHA-256 hash is stored, so a database leak
  cannot be replayed as a working reset link.
- It expires after `PASSWORD_RESET_TTL_MINUTES`, 60 by default, and works exactly once.
- Requesting a reset gives the same answer whether or not the email has an account, so the
  endpoint cannot be used to discover who is registered.
- Five requests per hour per network, because each one sends an email.
- A completed reset clears the session cookie and emails a confirmation, so an unexpected
  change gets noticed.

---

## Deploying to Vercel and Railway

The API runs on Railway and the web app on Vercel. One detail decides whether
this works at all: **the browser must see the API on the same origin as the
site.** A cookie set by a different domain is a third-party cookie, and Safari
refuses those, so every iPhone would fail to sign in. `client/vercel.json`
therefore forwards `/api/*` from Vercel to Railway, keeping the cookie
first-party. Real-time uses a short-lived token instead of the cookie, so it
works even across domains.

### 1. Push the repository to GitHub

```bash
git add -A
git commit -m "Educational platform"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`server/.env` is ignored and must never be committed.

### 2. The API on Railway

1. On [railway.app](https://railway.app), create a project from your GitHub repo.
2. In the service settings set **Root Directory** to `server`.
3. Add these variables under **Variables**:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas connection string |
| `JWT_SECRET` | a fresh long random string |
| `COOKIE_SECRET` | another fresh long random string |
| `CLIENT_URL` | your Vercel URL, added after step 3 |
| `TEACHER_NAME`, `TEACHER_EMAIL`, `TEACHER_PASSWORD`, `PLATFORM_NAME`, `TEACHER_SUBJECT` | your details |
| `CLOUDINARY_*`, `SMTP_*`, `ZOOM_*` | the same values you use locally |

Railway gives the service a public domain such as
`https://your-api.up.railway.app`. Check `https://your-api.up.railway.app/api/health`
returns `{"success":true}`.

In MongoDB Atlas, allow Railway to connect: **Network Access** and add `0.0.0.0/0`,
or Railway's egress addresses if you prefer to be strict.

### 3. The web app on Vercel

1. On [vercel.com](https://vercel.com), import the same repository.
2. Set **Root Directory** to `client`. The framework is detected as Vite.
3. Edit `client/vercel.json` and replace `REPLACE-ME.up.railway.app` with your
   Railway domain, then commit and push.
4. Add one environment variable so real-time can reach the API directly:

```
VITE_SOCKET_URL = https://your-api.up.railway.app
```

Vercel gives you a URL such as `https://your-app.vercel.app`.

### 4. Close the loop

Set `CLIENT_URL` on Railway to your Vercel URL and redeploy. Several origins can
be listed, comma separated, if you also want preview deployments to work:

```
CLIENT_URL=https://your-app.vercel.app,https://your-app-git-main-you.vercel.app
```

### 5. Create the teacher account

From your machine, with `server/.env` pointing at the same Atlas database:

```bash
npm run seed
```

Then sign in and change the password immediately from **Account settings**.

### A custom domain, later

Once you own a domain, point the site at `app.example.com` and the API at
`api.example.com`. Both are then the same site, the rewrite becomes optional,
and the cookie question disappears entirely. Update `CLIENT_URL` and
`VITE_SOCKET_URL` to match.

### The single-service alternative

If you would rather not run two services, Railway alone can serve everything:
build the client and let the API serve it, which puts the site and the API on
one origin with no rewrite and no CORS. Build `client` and deploy the repo root
with `NODE_ENV=production`; the server serves `client/dist` when that folder is
present next to it.
