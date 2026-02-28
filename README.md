# CICR Connect

A full-stack web application for managing CICR (Community & Institutional Collaboration Resources) operations — including projects, events, meetings, members, inventory, learning resources, and more.

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 19, Vite, Tailwind CSS, React Router, Framer Motion |
| Backend   | Node.js, Express 5, MongoDB, Mongoose           |
| Auth      | JSON Web Tokens (JWT), bcryptjs                 |
| Email     | Nodemailer / Resend                             |
| AI        | Google Gemini API (optional)                    |
| Deploy    | Vercel (frontend), Render (backend)             |

## Features

- **Authentication** — register, login, email verification, password reset, account lockout
- **Dashboard** — personalized overview of activity and tasks
- **Projects** — create, review, and track projects
- **Meetings** — schedule and manage meetings
- **Events** — browse and manage community events
- **Members & Hierarchy** — member directory and organizational hierarchy
- **Inventory** — track and manage resources
- **Community** — posts and community discussion feed
- **Communication** — internal messaging and notifications
- **Learning Hub** — learning resources and programmes
- **Programs Hub** — manage and explore programmes
- **Issue Tracker** — report and track issues
- **Admin Panel** — user and content administration
- **AI Summariser / Chatbot** — Gemini-powered assistant (optional)

## Repository Structure

```
CICRCombined/
├── cicrconnectbackend/   # Node.js / Express REST API
├── cicrfrontend/         # React / Vite SPA
├── docs/                 # Deployment and operations documentation
└── render.yaml           # Render deployment configuration
```

## Getting Started

### Prerequisites

- Node.js >= 22
- A running MongoDB instance (local or Atlas)

### Backend

```bash
cd cicrconnectbackend
cp .env.example .env      # fill in the required values (see below)
npm install
npm run dev               # starts on http://localhost:4000
```

Key environment variables (see `cicrconnectbackend/.env.example` for the full list):

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random secret for signing tokens |
| `DATA_ENCRYPTION_KEY` | 32-byte key used to encrypt sensitive data |
| `FRONTEND_URL` | Allowed CORS origin (e.g. `http://localhost:5173`) |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `GEMINI_API_KEY` | Google Gemini key (optional – enables AI features) |

### Frontend

```bash
cd cicrfrontend
cp .env.example .env      # set VITE_API_BASE_URL
npm install
npm run dev               # starts on http://localhost:5173
```

## Scripts

### Backend (`cicrconnectbackend/`)

| Command | Description |
|---|---|
| `npm start` | Start production server |
| `npm run dev` | Start development server with hot-reload |
| `npm test` | Run test suite |
| `npm run lint` | Run linter |
| `npm run check:migrations` | Verify pending migrations |
| `npm run migrate:encrypt` | Encrypt existing data |
| `npm run verify:encryption` | Verify encrypted data integrity |

### Frontend (`cicrfrontend/`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## API Endpoints

The backend exposes the following route groups under `/api`:

| Route | Description |
|---|---|
| `/api/auth` | Authentication (login, register, verify, reset) |
| `/api/users` | User profiles |
| `/api/projects` | Project management |
| `/api/meetings` | Meeting scheduling |
| `/api/events` | Events |
| `/api/admin` | Admin operations |
| `/api/chatbot` | AI chatbot |
| `/api/inventory` | Inventory management |
| `/api/community` | Community posts |
| `/api/communication` | Messaging |
| `/api/issues` | Issue tracking |
| `/api/applications` | Applications |
| `/api/notifications` | Notifications |
| `/api/hierarchy` | Organizational hierarchy |
| `/api/learning` | Learning resources |
| `/api/programs` | Programmes |
| `/api/health` | Health check |
| `/api/ready` | Readiness probe |

## Deployment

The application is deployed using:

- **Backend** → [Render](https://render.com) (configured in `render.yaml`)
- **Frontend** → [Vercel](https://vercel.com) (configured in `cicrfrontend/vercel.json`)

See [`docs/deployment/ROLLBACK_SAFE_DEPLOY.md`](docs/deployment/ROLLBACK_SAFE_DEPLOY.md) for the recommended deployment and rollback procedure.

## Contributing

1. Fork the repository and create a feature branch.
2. Make your changes, ensuring all tests and linters pass.
3. Open a pull request against `main`.

## License

ISC
