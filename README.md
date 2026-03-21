# CoFounders 🤖

> Built at the **Neurax Hackathon**

CoFounders is an AI-powered workforce orchestration system that takes in a Product Requirements Document (PRD) and autonomously delegates, assigns, and executes tasks across your entire company — using your employees' own resumes as the source of truth for skills.

---

## What It Does

1. **Ingests Company Context** — Upload resumes for all employees in your organisation and provide a PRD for the project to be built.

2. **Breaks Down the PRD** — The system parses the PRD and decomposes it into discrete, actionable tasks.

3. **Assigns Tasks Intelligently** — Each task is matched to the most suitable employee based on skills extracted from their resume.

4. **Spawns Subagents** — Using [CrewAI](https://github.com/joaomdmoura/crewAI), a dedicated subagent is spawned for each employee to autonomously code out their assigned task.

5. **Handles Gaps Automatically** — If a task cannot be mapped to any existing employee, the system:
   - Creates a virtual "new hire" profile
   - Codes out the task on their behalf
   - Alerts the company that they need to hire someone with **X, Y, Z skills**

---

## Project Structure
```
/
├── code/
│   ├── neurax_frontend/    # Frontend — see README inside
│   └── neurax_backend/     # Backend — see README inside
```

For detailed setup and implementation notes, refer to the READMEs inside each subdirectory:
- [`code/neurax-frontend/README.md`](code/neurax-frontend/README.md)
- [`code/neurax-backend/README.md`](code/neurax-backend/README.md)

---

## Tech Stack

- **Orchestration:** CrewAI (multi-agent subagent spawning)
- **Resume Parsing:** Automated skill extraction from employee resumes
- **Task Allocation:** PRD decomposition + skill-to-task matching

---

## Built At

**Neurax Hackathon**
