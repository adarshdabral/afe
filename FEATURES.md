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
| Flagship course "AI for Everyone" | ✅ | 12 modules, each with a 7-section lesson and one assessment |

### 1.3 Learning experience (students)
| Feature | Status | Notes |
|---|---|---|
| Student dashboard | ✅ | Learning stats, every published course with its modules, per-course progress, Start/Continue |
| Course player | ✅ | `/learn/[slug]` with module, lesson and assessment views and a course sidebar |
| Lesson content types | ✅ | Video (YouTube/embed or file), PDF, **presentation** (slides), rich text, infographic, case study, reflection, activity |
| Document/slide viewer | ✅ | Inline viewer plus Open-in-new-tab and Download, so files work on mobile too |
| Sequential unlocking | ✅ | A lesson unlocks only after the previous one is complete |
| Progress tracking | ✅ | Lessons, modules, overall %, visits and time spent, saved on the server |
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
| Course CMS — modules & lessons | ✅ | Create/edit/delete, drag-to-reorder, preview flag, duration estimates, rich content editor |
| Lesson file uploads | ✅ | Upload PDF, PowerPoint or images (≤ 25 MB) straight from the lesson editor, or paste a URL |
| Lesson video uploads | ✅ | Video lessons: upload MP4/WebM/MOV (≤ 500 MB) with progress and preview, or paste a YouTube/Vimeo/file URL |
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
| Shared access rules | One `guardRedirect` / `ROUTE_ACCESS` definition mirrored in frontend and backend |
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
| Idempotent startup seeding | Demo users, analytics cohort and forum content are created safely on every boot |
| Content seed | `npm run seed` rebuilds "AI for Everyone" and archives every other course (run deliberately) |
| Idempotent certificate issuance | One certificate per student per course; issuance retries on the next progress update if it fails |
| Consistent API envelope | `{ data }` on success, `{ error: { message } }` on failure; central error handler |
| Health check | `GET /api/health` |

### 2.3 Deployment & hosting
| Feature | Notes |
|---|---|
| Single-origin hosting | One EC2 host; reverse proxy sends `/api/*` → Express :4000 and everything else → Next.js :3000 |
| Reverse proxy configs | `deploy/apache-ai-spark.conf` (live) and `deploy/nginx.conf` (documented) |
| TLS | Let's Encrypt cert (sslip.io hostname), auto-renewed by certbot; HTTP → HTTPS redirect |
| Process management | PM2 (`deploy/ecosystem.config.cjs`): auto-restart, restart limits, memory caps (API 400 MB, web 600 MB) |
| Deploy-safe caching | HTML is never cached, so stale pages can't reference deleted JS chunks after a release; hashed static assets stay cacheable |
| Upload-sized proxy limit | Apache/nginx allow ~520 MB request bodies (lesson videos) with 15-minute proxy timeouts |
| Internal API calls | Next.js middleware talks to the API on `127.0.0.1` (`INTERNAL_API_URL`), so it doesn't depend on public DNS/TLS |
| Bootstrap script | `deploy/setup-ec2.sh` plus `.env.production.example` templates for both apps |
| Persistent upload storage | `backend/uploads/` lives outside git and must be excluded from deploy syncs and backed up |

### 2.4 Configuration
| Variable | App | Purpose |
|---|---|---|
| `MONGODB_URI`, `PORT`, `NODE_ENV` | backend | Database and runtime |
| `JWT_SECRET` | backend | Session signing (required in prod) |
| `CORS_ORIGIN` | backend | Allowed browser origin |
| `REQUIRE_TEACHER_APPROVAL` | backend | Turn on the student-approval workflow |
| `APP_PUBLIC_URL` | backend | Origin used in certificate QR codes |
| `UPLOAD_DIR`, `UPLOAD_MAX_BYTES`, `UPLOAD_VIDEO_MAX_BYTES` | backend | Upload location and size caps (documents 25 MB, videos 500 MB) |
| `SEED_*_PASSWORD` | backend | Override demo account passwords |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | Browser API base (set before `next build`) |
| `INTERNAL_API_URL` | frontend | Server-side API base for middleware |

### 2.5 Quality assurance
| Feature | Notes |
|---|---|
| End-to-end verification harnesses | `backend/verify/*.mts` boot an in-memory MongoDB and the real API, covering auth, RBAC, registration, teachers, Course CMS, content seed, uploads, learning engine, assessments, progress, certificates, reviews and forum |
| Full user-journey tests | `e2e-student-journey` (register → certificate → verify) and `e2e-admin-journey` (teachers → CMS → assessments → certificates → analytics) |
| Real middleware test | `middleware-e2e` runs `next start` against the live API and checks actual redirects |
| Type safety | `next build` and `tsc` type-check both apps |

### 2.6 Known gaps
- Password reset is UI-only (no email delivery).
- Uploaded files live on the EC2 disk, not object storage, so they need their own backup.
- `DEPLOY.md` and `PROJECT_MEMORY.md` describe the old TanStack app and are stale.
