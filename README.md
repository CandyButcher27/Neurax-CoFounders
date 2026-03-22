# CoFounders 🤖 — AI Workforce Orchestration System

> 🥇 **First Place** — Neurax Hackathon

CoFounders is a multi-agent AI system that takes a Product Requirements Document (PRD) and autonomously decomposes, assigns, and executes software tasks across a simulated company workforce — using employee resumes as the authoritative source of skills.

---

## The Problem

Software delivery breaks down at the handoff between planning and execution. A PRD arrives, a tech lead manually reads it, guesses who owns what, and tasks get assigned based on imperfect knowledge of who can actually do them. CoFounders replaces this bottleneck with an autonomous orchestration pipeline.

---

## System Architecture

The system is composed of three sequential stages, each handled by a distinct AI component:

```
PRD (text)  +  Resumes (text)
        │
        ▼
┌─────────────────────────┐
│   1. PRD Parser Agent   │  ← Decomposes PRD into discrete, atomic tasks
│      (LLM-powered)      │    with inferred skill requirements per task
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  2. Skill Matcher       │  ← Extracts skills from resumes via NLP,
│                         │    scores task-employee compatibility,
│                         │    assigns tasks using a greedy best-fit
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  3. CrewAI Subagents    │  ← Spawns one autonomous agent per assigned
│     (one per employee)  │    task; each agent independently codes
│                         │    out its task using tool use + LLM calls
└─────────────────────────┘
```

### Gap Handling

If no existing employee's skill profile satisfies a task's requirements, the system:
1. Creates a synthetic "new hire" agent profile
2. Executes the task on their behalf
3. Emits a structured hiring alert: *"You need someone with skills X, Y, Z"*

This design ensures no task is silently dropped — every PRD item reaches execution or surfaces a concrete gap.

---

## Agent Design Decisions

**Why CrewAI for subagent spawning?**
CrewAI provides a process-oriented abstraction for multi-agent coordination. Each employee maps to a `Crew` with a single `Agent` and `Task`, which gives isolated execution context and avoids cross-task contamination in the LLM's working memory. Alternatives like LangGraph were considered but introduced unnecessary graph complexity for what is fundamentally a fan-out (not a cyclic) workflow.

**Why resume-based skill extraction instead of manual tagging?**
The goal was zero configuration from the company side. LLM-based extraction from free-text resumes is noisier than structured tags, but it generalises across resume formats and reflects real-world hiring data — which is almost never structured consistently.

**Why decompose the PRD before matching, not during?**
Decomposing first produces a stable task list that can be matched, logged, and audited independently of the assignment step. Doing both in one LLM call made the output harder to validate and prone to task-skill conflation.

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| Agent orchestration | CrewAI | Process-based multi-agent fan-out |
| LLM backend | Gemini 2.0 Flash (via Gemini CLI) | Cost-efficient, fast inference under hackathon constraints |
| PRD parsing | Custom LLM prompt chain | Structured JSON task output with skill annotations |
| Resume parsing | LLM-based NLP extraction | Format-agnostic skill extraction from free text |
| Backend API | FastAPI | Lightweight async HTTP layer |
| Frontend | React + Vanilla JS | Hackathon-scope UI for file upload and task display |

---

## Project Structure

```
/
├── code/
│   ├── neurax_frontend/    # React frontend — file upload, task board UI
│   └── neurax_backend/     # FastAPI backend — orchestration, agents, matching
└── README.md
```

See sub-READMEs for setup and run instructions:
- [`code/neurax_backend/README.md`](./code/neurax-backend/README.md)
- [`code/neurax_frontend/README.md`](./code/neurax-frontend/README.md)

---

## Limitations & Honest Scope

- Built under hackathon time constraints (~24 hours); production hardening not applied
- Skill matching uses greedy assignment, not optimal global allocation
- No persistent state — each run is stateless
- Subagent code output quality is LLM-dependent and not formally evaluated

---

## Built At

**Neurax Hackathon — 🥇 First Place**
