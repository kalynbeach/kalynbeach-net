# Notes

## Design

### Fonts

### Colors

---

## App

### Routes & Pages

- `/`: `Home` page
- `/code`: `Code` page
- `/sound`: `Sound` page
- `/auth`
  - `/signin`: `SignIn` page
- `/(admin)`
  - `/dashboard`: `Dashboard` page
  - `/settings`: `Settings` page

### Components

- `WavePlayer`

### Hooks

- `useWavePlayer`

---

## Database

### Stack

- PostgreSQL (Vercel)
- Drizzle ORM
- Drizzle Kit

### Tables

#### Initial Tables

- `users`: Users (primarily for protected routes)
- `sounds`: Music file data objects
- `projects`: Code projects (repositories)

#### Future Tables

- `photos`: Personal photo data objects
- `posts`: Blog posts
