# AI For Everyone — Feature Inventory

What the ai-spark platform does today, split into **platform features** (what
learners, teachers and admins can do in the product) and **operational features**
(how the system is secured, run, deployed, verified and maintained).

Developer-facing architecture lives in `CLAUDE.md`; deployment steps in
`DEPLOY_AWS.md`. Status legend: ✅ live · ⚙️ configurable · 🚧 UI only / partial.

---

## Part 1 — Platform features

### 1.1 Accounts, roles & access
| Feature | Status | Notes |
|---|---|---|
| Three roles: Student, Teacher, Platform Admin | ✅ | Each has its own surface (`/student`, `/instructor`, `/admin`) and sidebar |
| Login with email **or** username | ✅ | Admin logs in as `Moocs@admin` |
| Persistent 7-day sessions | ✅ | httpOnly `afe_session` cookie |
| Role-based landing & redirects | ✅ | Wrong-role visitors are sent to their own home, never escalated |
| Student self-registration | ✅ | Picks their teacher from a public directory; school name is free text |
| Teacher approval of new students | ⚙️ | Off by default; enable with `REQUIRE_TEACHER_APPROVAL=true`. Pending students see `/student/pending` |
| Forgot password | 🚧 | Screen exists; no reset email/backend yet |
| Dark mode | ✅ | Per-browser preference |

### 1.2 Course discovery
| Feature | Status | Notes |
|---|---|---|
| Single-course landing page | ✅ | `/` — "AI Spark presents AI for Everyone": hero, course facts, outcomes, curriculum, instructor, certificate, reviews — all derived from the live course (server-rendered for SEO) |
| No catalog | ✅ | `/courses` redirects to the flagship course page (single-course product) |
| Course detail page | ✅ | `/courses/[slug]` — facts, outcomes, curriculum accordion, instructor, certificate, reviews, grounded FAQ |
| Certificate lookup | ✅ | `/certificate/verify` — enter an ID → `/certificate/verify/[id]` |
| Ratings & reviews | ✅ | Logged-in users add/edit/delete their review; average rating recomputed automatically |
| Flagship course "AI for Everyone" | ✅ | 12 modules, each with one lesson container holding seven topics, plus one assessment |
| Course sections | ✅ | Course Introduction, Course Overview and Meet the Instructor, editable from the admin CMS |

### 1.3 Learning experience (students)
| Feature | Status | Notes |
|---|---|---|
| Student dashboard | ✅ | Learning stats, every published course with its modules, per-course progress, Start/Continue |
| Course player | ✅ | `/learn/[slug]` with course-section, module, lesson-container, topic and assessment views, plus a progress-aware sidebar |
| Module structure | ✅ | Every module has a **description**, **learning objectives** and **one module assessment** (tests are per module, not per lesson or topic); a module can only be published when all three are in place — the CMS shows a checklist |
| Multi-part topics | ✅ | Each topic can combine **text**, **audio narration**, a **PDF or PowerPoint**, and a **video with subtitles** (WebVTT; SRT accepted) |
| Topic formats | ✅ | Primary format label: video, PDF, presentation, rich text, infographic, case study, reflection, activity |
| Document/slide viewer | ✅ | PDFs inline, PowerPoint via the Office web viewer, plus Open-in-new-tab and Download |
| Sequential unlocking | ✅ | A topic unlocks only after the previous topic is complete |
| Progress tracking | ✅ | Topics, modules, overall %, visits and time spent, saved on the server; legacy lesson completions migrate with their IDs |
| Module assessments | ✅ | MCQ, True/False, reflection and scenario questions; instant scoring with pass/fail against a passing score; attempt history |
| Answer-key protection | ✅ | Correct answers are never sent to the student's browser |
| Certificates | ✅ | Issued automatically on course completion; branded PDF download with QR code |
| Public certificate verification | ✅ | `/certificate/verify/[id]` — anyone can confirm a certificate is genuine and not revoked |
| Discussion forum | ✅ | Threads and replies for students |

### 1.4 Teacher tools (`/instructor`)
| Feature | Status | Notes |
|---|---|---|
| Teacher dashboard | ✅ | |
| Student approval queue | ✅ | Approve/reject registrations assigned to them (when approval mode is on) |
| Class analytics | ✅ | Performance and progress of their own students |
| Forum participation & moderation | ✅ | Hide/unhide threads and posts |
| Course preview | ✅ | Can open `/learn/*` to view course content |

### 1.5 Platform admin tools (`/admin`)
| Feature | Status | Notes |
|---|---|---|
| Admin dashboard | ✅ | Schools, students, certificates issued, completion rate; quick links |
| Teacher management | ✅ | Create, edit, search/filter/paginate, activate/deactivate, reset password (one-time temporary password shown once) |
| Course CMS — courses | ✅ | Create/edit, draft → published → archived, soft delete (content is never destroyed) |
| Course CMS — modules, lessons & topics | ✅ | Create/edit/delete lesson containers and topics, drag-to-reorder, preview flag, duration estimates, rich content editor |
| Course section editor | ✅ | Edit introduction, overview and instructor content with the shared multi-part editor |
| Topic media uploads | ✅ | Video (≤ 500 MB), audio (≤ 100 MB), PDF/PPT/images (≤ 25 MB) and subtitles from the topic editor, with progress and preview — stored in **Cloudflare R2** (direct browser upload) or on the backend's disk; or paste a URL (YouTube/Vimeo for video) |
| Generated narration | ⚙️ | "Generate from text" turns topic text into MP3 audio with Cloudflare Workers AI (Deepgram Aura-2) — male voice by default, voice picker in the editor (needs `CLOUDFLARE_AI_TOKEN`) |
| Narration speed | ✅ | Audio plays at 0.9× by default for clarity; learners can pick 0.75×–1.25× (pitch preserved, remembered per device) |
| Assessment builder | ✅ | Per-module assessments: question CRUD, reorder, passing score, publish/unpublish |
| Certificate management | ✅ | List all certificates, revoke |
| Platform & school analytics | ✅ | National totals and per-school engagement (grouped by school name) |
| Approval override | ✅ | Can approve/reject any student registration |
| Forum moderation | ✅ | Same as teachers |

---

## Part 2 — Operational features

### 2.1 Security
| Feature | Notes |
|---|---|
| Server-enforced RBAC | Every protected API checks session + role; frontend guards are UX only |
| Two-layer route guarding | Next.js middleware redirects by role; API returns 401/403 |
| Shared access rules | One `guardRedirect` / `ROUTE_ACCESS` definition, mirrored in `frontend/lib/access.ts` and `backend/server/shared/access.ts` |
| Password hashing | PBKDF2-HMAC-SHA256 (Web Crypto); timing-safe login for unknown users |
| Secure session cookie | httpOnly, `sameSite=lax`, `secure` in production; JWT secret ≥ 32 chars required in prod (server refuses to boot otherwise) |
| Input validation | All request bodies validated with zod → consistent 400s |
| Upload hardening | Admin-only; extension **and** MIME allow-list; random server-side filenames; size cap (413); wrong type (415); read-only serving with no directory listing or dotfiles |
| No secrets client-side | Frontend only receives public config |
| Teacher provisioning | Teachers cannot self-register; temp passwords are never stored in plaintext |

### 2.2 Data & reliability
| Feature | Notes |
|---|---|
| MongoDB Atlas persistence | All domain data is server-side |
| Soft deletes | Courses keep a `deletedAt` marker instead of being destroyed |
| Legacy content migration | On backend startup, old content-bearing lessons migrate to topics with matching IDs, completion records are preserved, lesson containers and course sections are created, and reruns are idempotent |
| Idempotent startup seeding | Demo users, analytics cohort and forum content are created safely on every boot |
| Content seed | `npm run seed` rebuilds "AI for Everyone" and archives every other course (run deliberately); `npm run seed:flagship` rebuilds it and keeps the others |
| Idempotent certificate issuance | One certificate per student per course; issuance retries on the next progress update if it fails |
| Consistent API envelope | `{ data }` on success, `{ error: { message } }` on failure; central error handler |
| Health check | `GET /api/health` |

### 2.3 Deployment & hosting
| Feature | Notes |
|---|---|
| Two Next.js apps | `frontend/` (UI) on **Vercel**, `backend/` (API) on **Render** (`render.yaml` Blueprint) — see `DEPLOY.md` |
| Same-origin API for the browser | The frontend rewrites `/api/*` to the backend, so the login cookie stays first-party in every browser; Vercel CDN caching is off for `/api` and API responses are `no-store` |
| Direct large uploads | Topic and course-section media goes straight from the browser to Cloudflare R2 (1-hour presigned URLs bound to type + size); without R2, straight to the backend with a 15-minute upload-only token; CORS limited to the frontend origin |
| Media storage | Cloudflare R2 bucket (public reads via r2.dev or a custom domain; `npm run r2:cors` sets bucket CORS). Fallback: `backend/uploads/` (Render: Persistent Disk via `UPLOAD_DIR`), streamed to disk — back it up |
| Health check | `GET /api/health` (Render health check; 503 when the database is down) |
| Self-hosted alternative | Both apps on one EC2 box (`DEPLOY_AWS.md`, `backend/deploy/`): PM2 (`ai-spark-api` :4000, `ai-spark-web` :3000), Apache (live) / nginx with Let's Encrypt TLS, ~520 MB bodies, 15-min timeouts, no-cache HTML, `setup-ec2.sh` bootstrap |

### 2.4 Configuration
| Variable | Used by | Purpose |
|---|---|---|
| `MONGODB_URI` | backend | Database |
| `JWT_SECRET` | backend | Session signing (required in prod) |
| `REQUIRE_TEACHER_APPROVAL` | backend | Turn on the student-approval workflow |
| `APP_PUBLIC_URL` | backend | Frontend origin used in certificate QR codes |
| `CORS_ORIGIN` | backend | Frontend origin(s) allowed to upload directly |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | backend | Cloudflare R2 media storage |
| `CLOUDFLARE_AI_TOKEN` (+ `TTS_MODEL`, `TTS_VOICE`, `TTS_LANG`) | backend | Workers AI text-to-speech (default Aura-2, voice `orion`) |
| `UPLOAD_DIR`, `UPLOAD_*_MAX_BYTES` | backend | Local-fallback location and size caps (documents 25 MB, videos 500 MB, audio 100 MB, subtitles 2 MB) |
| `SEED_*_PASSWORD` | backend | Override demo account passwords |
| `NEXT_PUBLIC_BACKEND_URL` | frontend | Backend origin for the `/api` rewrite, middleware, SSR, uploads and media (build-time) |

### 2.5 Quality assurance
| Feature | Notes |
|---|---|
| End-to-end verification harnesses | `backend/verify/*.mts` boot an in-memory MongoDB and the real backend app in-process, covering auth, RBAC, registration, teachers, Course CMS, content seed, uploads, learning engine, assessments, progress, certificates, reviews and forum |
| Full user-journey tests | `e2e-student-journey` (register → certificate → verify) and `e2e-admin-journey` (teachers → CMS → assessments → certificates → analytics) |
| Real middleware test | `middleware-e2e` boots both apps and checks SSR, the `/api` rewrite, the login cookie and redirects |
| Type safety | `next build` and `npm run typecheck` (tsc) in each app |

### 2.6 Known gaps
- Password reset is UI-only (no email delivery).
- Without R2 configured, uploaded files live on the backend's disk (Render Persistent Disk or EC2) and need their own backup; Render's free plan has no persistent disk.
- Replacing or removing a lesson file doesn't delete the old object from storage.
- `PROJECT_MEMORY.md` and the migration-plan docs describe older states and are stale.
