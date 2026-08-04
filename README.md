# InterviewStack

AI-powered real-time technical interview platform built with React, Node.js, Yjs CRDT, Redis, BullMQ, LiveKit, and Gemini AI.

InterviewStack enables interviewers and candidates to collaborate through a shared code editor, video/audio communication, AI-powered resume analysis, automated interview feedback, and live code execution. The platform is designed with distributed systems principles and production-oriented architecture.

---

## Features

### Authentication & Authorization

- JWT Authentication
- Role-Based Access Control
- Secure session restoration
- Protected routes
- Server-authoritative room permissions
- Secure LiveKit token generation

### Real-Time Collaborative Coding

- Monaco Editor
- Yjs CRDT synchronization
- Live cursors
- Presence awareness
- Google Docs–style collaborative editing
- Automatic reconnection
- Shared editor state
- Room recovery
- Redis-backed synchronization

### Live Interviewing

- LiveKit WebRTC integration
- Video calling
- Audio calling
- Camera controls
- Microphone controls
- Participant management

### Code Execution

- Multi-language execution
- JDoodle integration
- Shared execution output
- Real-time result synchronization
- Asynchronous submission pipeline

### AI Features

#### Resume Analysis

- Technical skill analysis
- Experience summary
- Strengths & weaknesses
- AI recommendations

#### AI Interview Feedback

- Code review
- Time & space complexity analysis
- Hiring recommendation
- Improvement suggestions

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Monaco Editor
- TanStack Query
- Socket.IO Client
- Yjs
- LiveKit
- Tailwind CSS
- Framer Motion

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- Redis
- BullMQ
- Socket.IO
- Gemini AI
- JDoodle

### Infrastructure

- Vercel
- Render
- MongoDB Atlas
- Upstash Redis
- LiveKit Cloud

---

## Architecture

```text
                        React SPA
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
        ▼                   ▼                    ▼
 Socket.IO Client      REST API            LiveKit SDK
        │                   │                    │
        └───────────────┬───┴────────────────────┘
                        ▼
                 Express Backend
                        │
      ┌─────────────────┼─────────────────┐
      ▼                 ▼                 ▼
   Socket.IO         BullMQ           MongoDB
      │                 │
      ▼                 ▼
 Redis Pub/Sub      AI Workers
      │
      ▼
 Gemini AI / JDoodle
```

---

## Core Engineering Concepts

- Conflict-Free Replicated Data Types (Yjs CRDT)
- Real-time collaborative editing
- WebRTC video/audio communication
- Distributed Pub/Sub with Redis
- Background job processing using BullMQ
- Event-driven architecture
- Role-based authorization
- Redis-backed rate limiting
- Graceful shutdown
- Retry and recovery mechanisms

---

## Project Structure

```text
InterviewStack
├── frontend
├── backend
│   ├── controllers
│   ├── middleware
│   ├── models
│   ├── routes
│   ├── services
│   ├── sockets
│   ├── workers
│   ├── queues
│   └── config
└── README.md
```

---

## Getting Started

### Backend

```bash
cd backend
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Backend

```env
PORT=
MONGO_URI=
JWT_SECRET=
REDIS_URL=

LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_WS_URL=

GEMINI_API_KEY=

JDOODLE_CLIENT_ID=
JDOODLE_CLIENT_SECRET=
```

Frontend

```env
VITE_API_URL=
VITE_LIVEKIT_URL=
```

---

## Deployment

| Component | Platform |
|----------|----------|
| Frontend | Vercel |
| Backend | Render |
| Database | MongoDB Atlas |
| Redis | Upstash |
| Video | LiveKit Cloud |

---

## Resume Highlights

- Built a production-grade real-time technical interview platform with collaborative coding, AI-powered evaluation, and integrated video communication.
- Implemented Google Docs–style collaborative editing using Yjs CRDT, Redis Pub/Sub, and live cursor synchronization.
- Designed asynchronous processing pipelines using BullMQ and Redis for code execution, resume analysis, and AI feedback.
- Integrated LiveKit WebRTC and Gemini AI to deliver end-to-end remote interviewing with automated candidate insights.
- Engineered a scalable backend with secure authentication, background workers, distributed synchronization, and cloud deployment.

---

## Roadmap

- Collaborative whiteboard
- OpenTelemetry
- Automated testing
- GitHub Actions CI/CD
- Metrics and monitoring

---

## License

MIT
