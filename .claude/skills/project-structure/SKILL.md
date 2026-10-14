---
name: project-structure
description: Explains what each project folder stores and where new files belong. Use when creating, moving, or locating files in the project, or when deciding which folder something should go in.
---

# Project structure

This project keeps the frontend and backend separated inside `src/`. Before creating a file, determine which side it belongs to, then pick the folder based on its responsibility as described below.

```
project/
├── public/
├── src/
│   ├── backend/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── docs/
│   └── frontend/
│       ├── assets/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── store/
│       ├── styles/
│       └── utils/
├── .env
└── .env.example
```

## Root

| Item | What it stores |
|---|---|
| `public/` | Static files served at a fixed URL without going through the bundler: `favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.json`, `og-image.png`, downloadable PDFs, `sw.js`, the `.well-known/` folder. |
| `.env` | Real environment variables (passwords, API keys, `DATABASE_URL`, port). **Never committed to Git.** |
| `.env.example` | Template of `.env` with the same variable names and empty or placeholder values. **Committed to Git** and must be updated whenever a new variable is added. |

## `src/backend/`

A request flows through: **routes → middlewares → controllers → services → models**.

| Folder | What it stores |
|---|---|
| `config/` | Application configuration: database connection, loading and validating `.env` variables, CORS setup, logger, external service clients. |
| `routes/` | Endpoint definitions (HTTP method + URL) and which controller and middlewares each one uses. No business logic. |
| `middlewares/` | Functions that run before controllers: authentication, authorization, input validation, error handling, rate limiting. |
| `controllers/` | Receive the request, extract params and body, call the service, and return the response with the HTTP status. Keep them thin. |
| `services/` | Business logic: calculations, domain validation, orchestration between models and external integrations (email, payments). |
| `models/` | Data structure and database access: schemas, entities, queries, repositories. |
| `utils/` | Generic, stateless helper functions used by the backend: formatting, token generation, hashing, date helpers. |

## `src/frontend/`

| Folder | What it stores |
|---|---|
| `assets/` | Images, icons, fonts, and media **imported by the code**. Processed by the bundler (optimization and hashed filenames). |
| `components/` | Reusable UI components: buttons, inputs, modals, cards, header, footer. They do not represent a full page. |
| `pages/` | Screens tied to routes (Home, Login, Profile). They compose components and fetch data through services. |
| `hooks/` | Custom hooks with reusable logic: `useAuth`, `useFetch`, `useDebounce`. |
| `services/` | Communication with the backend and external APIs: the configured HTTP client and functions like `getUsers()`, `login()`. Components never make requests directly. |
| `store/` | Global application state (Redux, Zustand, Pinia, Context): logged-in user, cart, theme. |
| `styles/` | Global styles: reset, color and spacing variables, themes, typography. Component-specific styles live next to the component. |
| `utils/` | Pure frontend helper functions: currency and date formatting, input masks, email and ID validation. |

## `src/docs/`

Project documentation: architecture, technical decisions, API documentation, setup guides, and diagrams.

## Deciding where a file goes

- Needs a fixed URL or must keep its original name? → `public/`
- Image or font used inside a component? → `frontend/assets/`
- Makes an HTTP request on the frontend? → `frontend/services/`
- A screen with its own route? → `frontend/pages/`; a reusable piece of a screen? → `frontend/components/`
- Defines an endpoint? → `backend/routes/`; handles the request? → `backend/controllers/`; contains business logic? → `backend/services/`; accesses the database? → `backend/models/`
- Runs before multiple routes (auth, validation)? → `backend/middlewares/`
- Generic function with no dependency on other layers? → `utils/` on the corresponding side
- Never import code from the frontend into the backend or vice versa; duplicate the minimum needed or create an explicit shared folder.

## General rules

- Never hardcode secrets; read them from `.env` through `backend/config/`.
- When adding a variable to `.env`, also add its key (without the value) to `.env.example`.
- Environment variables used in the frontend are visible in the browser; never put secrets in them.
- Don't create new folders in `src/` unless necessary; prefer the existing ones.