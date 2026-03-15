# cofounders.ai — Frontend (neurax-frontend)

Vanilla HTML/CSS/JS frontend for the cofounders.ai task assignment tool. No build step, no framework, no Node.js required.

---

## Pages

| File | URL | Purpose |
|---|---|---|
| `index.html` | `http://localhost:3000` | Cinematic marketing landing page |
| `app.html` | `http://localhost:3000/app.html` | 4-step app UI |

---

## Running the Frontend

The frontend is a static site served by Python's built-in HTTP server. The recommended way to start everything together is from the backend repo:

```powershell
# Run from the neurax/ directory
.\start_servers.ps1
```

This starts the frontend on **port 3000**, the main API on **port 8000**, and the resume parser on **port 8001**.

To serve the frontend on its own:

```bash
python -m http.server 3000
```

Then open `http://localhost:3000` in your browser.

---

## App Workflow

The app (`app.html`) walks through four sequential steps, each calling the backend at `http://localhost:8000`.

### Step 1 — Parse PRD

Paste raw PRD text or upload a `.txt` / `.pdf` file.

- Calls `POST /parse-prd`
- Renders a grid of task cards, each showing title, description, priority badge, and dependency links

### Step 2 — Upload Resumes

Drag and drop one or more PDF resumes onto the upload zone.

- Each file calls `POST /parse-resume`
- Renders rich employee cards showing name, skills, companies, education, experience level, and total months of experience

### Step 3 — Generate Crew

Click to generate a full CrewAI configuration from the parsed tasks and resumes.

- Calls `POST /crew-generate?output_subdir=output`
- Displays `agents.yaml` and `tasks.yaml` in a tabbed code preview
- Shows a banner with the output directory path

### Step 4 — Run & Download

Stream live Docker logs and download the result.

- Calls `POST /crew-run-stream` — opens an SSE connection and renders each log line in a real-time terminal view
- On completion, calls `GET /crew-download` to fetch `crew_output.zip`

---

## File Structure

```
neurax-frontend/
├── index.html      # Landing page markup
├── style.css       # Landing page styles
├── landing.js      # Three.js scene + GSAP scroll animations
├── app.html        # App UI markup
├── app.css         # App styles
└── app.js          # App logic — all API calls + DOM rendering
```

No `package.json`, no `node_modules`, no build output. All third-party libraries are loaded from CDN.

---

## Landing Page (`index.html`)

A scroll-driven cinematic introduction to cofounders.ai.

**Libraries (CDN):**
- [Three.js r128](https://threejs.org/) — 3D animated node network rendered on a fullscreen canvas
- [GSAP 3.12.2](https://gsap.com/) + ScrollTrigger — scroll-synced chapter transitions

**Scene:** 6 employee nodes and 12 task nodes connected by animated edges. The camera and node states transition across 4 scroll chapters.

**Scroll chapters:**

| Chapter | Theme |
|---|---|
| Hero | Opening cinematic — full node network visible |
| PRD to Tasks | Task nodes highlight as PRD is "parsed" |
| Assignment | Edges animate to show task-to-employee matching |
| Execute | All nodes pulse — crew runs |

**Other details:**
- Custom cursor
- Chapter progress dots (side navigation)
- "Launch App" buttons link to `app.html`

---

## App Page (`app.html`)

**Libraries:** None. Pure vanilla JavaScript — no external dependencies.

**Backend:** All fetch calls target `http://localhost:8000`. If you change the backend port, update the `BASE_URL` constant at the top of `app.js`.

---

## Design System

| Token | Value | Usage |
|---|---|---|
| Background | `#06070E` | Page background |
| Orange | `#FF5500` | Primary accent, CTAs |
| Cyan | `#00DFFF` | Secondary accent, highlights |
| Purple | `#7B2FFF` | Tertiary accent |
| Display font | Syne | Headings |
| Body font | DM Sans | Body text, UI labels |

---

## Prerequisites for the Full Stack

The frontend alone needs nothing beyond a browser. To use the app end-to-end:

1. Python 3.11+ and `uv` installed
2. Docker Desktop running
3. Backend `.env` configured (see the [backend README](../neurax/README.md))
4. Run `.\start_servers.ps1` from the `neurax/` directory
5. Open `http://localhost:3000`
