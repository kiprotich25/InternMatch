## Internship Match Engine

AI-powered internship matching and coaching platform for students. Stack:

- **Frontend**: React (Vite) + Tailwind CSS + ShadCN-style UI components
- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB (Mongoose)
- **AI**: Gemini API (via `@google/generative-ai`)

### Folder structure

- `backend/src`
  - `index.ts`: Express app bootstrap (Mongo connection, routes)
  - `models/`: `User`, `Internship`
  - `routes/`:
    - `auth`: register/login
    - `profile`: student profile (course, skills, locations, resume URL)
    - `internships`: list/create internships
    - `match`: AI-based match scoring & ranking
    - `ai`: CV tips, application emails, interview Q&A, networking help
    - `dashboard`: stats, skill gaps
    - `notifications`: prioritized internship suggestions
  - `services/aiService.ts`: Gemini prompts for scoring, CV, email, interview, networking
  - `seed/`: sample internship data seeding
- `frontend/src`
  - `App.tsx`: routes & main layouts
  - `hooks/useAuth.tsx`: auth context (login/register/logout)
  - `lib/api.ts`: Axios instance with JWT header
  - `components/ui/`: ShadCN-style `Button`, `Input`, `Card`
  - `pages (in App.tsx)`: login/register, dashboard, matches + AI assistant, interview simulator

### Prerequisites

- Node.js 18+
- MongoDB running locally (or Atlas URI)
- Gemini API key (`GEMINI_API_KEY`)

### Setup

```bash
cd "c:\Users\USER\Desktop\Hackathons\job finder"
cp .env.example .env   # or create equivalent on Windows

npm install
npm install -w backend
npm install -w frontend
```

Edit `.env` with your MongoDB URI, `JWT_SECRET`, and Gemini keys.

### Database seeding

Populate sample internships:

```bash
cd backend
npx ts-node src/seed/index.ts
```

This inserts a small set of software / data internships for testing.

### Running locally

In the project root:

```bash
npm run dev
```

This starts:

- **Backend** on `http://localhost:4000`
- **Frontend** on `http://localhost:5173`

The Vite dev server proxies `/api/*` to the backend.

### Core flows

- **Auth & profile**
  - Register/login via `/api/auth/*`
  - Update course, skills, preferred locations, resume URL via `/api/profile`
- **Internships & matching**
  - Backend normalizes internships into `Internship` model
  - `/api/match/recommendations` calls Gemini to score and rank internships per student
- **Application assistant**
  - `/api/ai/cv-improvements`: CV tailoring suggestions for a chosen internship
  - `/api/ai/application-email`: personalized email/cover letter draft
- **Interview simulator**
  - `/api/ai/interview-questions`: targeted mock questions
  - `/api/ai/interview-review`: feedback + improved answer
- **Dashboard & insights**
  - `/api/dashboard`: application counts, status breakdown, skill gaps from market demand
- **Notifications & prioritization**
  - `/api/notifications/prioritized`: new and high-scoring internships, with a priority score

### Production deployment (high level)

- **Backend**
  - Build: `cd backend && npm run build`
  - Deploy `dist` output to a Node host (Render/Heroku/Vercel functions/etc.).
  - Set environment variables from `.env` in your hosting platform.
- **Frontend**
  - Build: `cd frontend && npm run build`
  - Serve `dist` via a static host (Vercel, Netlify, S3+CloudFront, etc.).
  - Point frontend `VITE_API_BASE_URL` (if you add it) to your deployed backend URL.

The codebase is modular and can be extended with additional routes (e.g. richer networking, admin curation, more analytics) without changing existing contracts.

