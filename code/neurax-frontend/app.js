/* ======================================================
   cofounders.ai — App Logic
   Communicates with neurax backend at port 8000
   ====================================================== */

const API = 'http://localhost:8000';

// ── State ─────────────────────────────────────────────────────────
const state = {
  currentStep: 1,
  prdData: null,         // raw response from /parse-prd
  resumes: [],           // array of { filename, name, skills, data }
  crewData: null,        // response from /crew-generate
  runData: null,         // response from /crew-run
  prdMode: 'text',       // 'text' | 'file'
  prdFile: null,         // File object if mode='file'
  activeFileTab: null,   // currently shown file in step-3
};

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupDragDrop('prd-dropzone', 'prd-file', ['text/plain', 'application/pdf'], onPRDFileSelect);
  setupDragDrop('resume-dropzone', 'resume-file', ['application/pdf'], uploadResume);
  updateSidebar();
});

// ── Step Navigation ───────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');

  document.querySelectorAll('.step-btn').forEach(b => {
    b.classList.remove('active');
    if (parseInt(b.dataset.step) === n) b.classList.add('active');
  });

  state.currentStep = n;

  if (n === 3) updateGeneratePrereqs();
}

function updateSidebar() {
  document.getElementById('val-tasks').textContent =
    state.prdData ? (state.prdData.master?.tasks?.length ?? state.prdData.tasks?.length ?? '?') : '—';
  document.getElementById('val-resumes').textContent = state.resumes.length;
  document.getElementById('val-agents').textContent =
    state.crewData ? Object.keys(state.crewData.written_files || {}).length : '—';
}

function markStepDone(n) {
  const btn = document.querySelector(`.step-btn[data-step="${n}"]`);
  if (btn) btn.classList.add('done');
  const check = document.getElementById(`check-${n}`);
  if (check) check.classList.add('done');
}

// ── Tab switching (Step 1) ────────────────────────────────────────
function switchTab(mode) {
  state.prdMode = mode;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab-btn[onclick="switchTab('${mode}')"]`).classList.add('active');
  document.getElementById(`tab-${mode}`).classList.add('active');
}

// ── PRD File Select ───────────────────────────────────────────────
function onPRDFileSelect(inputOrFile) {
  const file = inputOrFile instanceof File ? inputOrFile : inputOrFile.files[0];
  if (!file) return;
  state.prdFile = file;
  document.getElementById('prd-filename').textContent = file.name;
  document.getElementById('prd-selected').style.display = 'flex';
}

function clearPRDFile() {
  state.prdFile = null;
  document.getElementById('prd-file').value = '';
  document.getElementById('prd-selected').style.display = 'none';
}

// ── Parse PRD ─────────────────────────────────────────────────────
async function parsePRD() {
  const btn = document.getElementById('parse-prd-btn');

  const fd = new FormData();

  if (state.prdMode === 'text') {
    const text = document.getElementById('prd-text').value.trim();
    if (!text) { toast('Paste some PRD text first.', 'error'); return; }
    fd.append('text', text);
  } else {
    if (!state.prdFile) { toast('Select a file first.', 'error'); return; }
    fd.append('file', state.prdFile);
  }

  setLoading(true, 'Parsing PRD with task-master…');
  setButtonLoading(btn, true);
  setBadge('busy');

  try {
    const res = await fetch(`${API}/parse-prd`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    state.prdData = await res.json();
    renderPRDResults(state.prdData);
    markStepDone(1);
    updateSidebar();
    toast('PRD parsed successfully!', 'success');
    setBadge('ready');
  } catch (e) {
    toast(`Parse failed: ${e.message}`, 'error');
    setBadge('error');
  } finally {
    setLoading(false);
    setButtonLoading(btn, false);
  }
}

function renderPRDResults(data) {
  const tasks = data.master?.tasks || data.tasks || [];
  const listEl = document.getElementById('task-list');
  listEl.innerHTML = '';

  tasks.forEach(task => {
    const pri = (task.priority || 'medium').toLowerCase();
    const deps = task.dependencies?.length ? `↳ deps: ${task.dependencies.join(', ')}` : '';
    const item = document.createElement('div');
    item.className = 'task-item';
    item.innerHTML = `
      <div class="ti-left">
        <span class="ti-id">#${task.id || ''}</span>
        <span class="ti-dot ${pri}"></span>
      </div>
      <div class="ti-content">
        <div class="ti-title">${escHtml(task.title || 'Untitled Task')}</div>
        <div class="ti-desc">${escHtml(task.description || '')}</div>
      </div>
      <div class="ti-meta">
        <span class="ti-pri ${pri}">${pri.toUpperCase()}</span>
        ${deps ? `<span class="ti-deps">${escHtml(deps)}</span>` : ''}
      </div>
    `;
    listEl.appendChild(item);
  });

  document.getElementById('task-count-badge').textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
  document.getElementById('prd-results').style.display = 'block';
}

// ── Upload Resume ─────────────────────────────────────────────────
const AVATAR_COLORS = [
  'linear-gradient(135deg,#FF5500,#7B2FFF)',
  'linear-gradient(135deg,#00DFFF,#7B2FFF)',
  'linear-gradient(135deg,#FF5500,#00DFFF)',
  'linear-gradient(135deg,#7B2FFF,#00DFFF)',
  'linear-gradient(135deg,#00E09B,#00DFFF)',
  'linear-gradient(135deg,#FF5500,#00E09B)',
];

async function uploadResume(inputOrFile) {
  const file = inputOrFile instanceof File ? inputOrFile
    : (inputOrFile.files ? inputOrFile.files[0] : null);
  if (!file) return;

  document.getElementById('resume-file').value = '';

  const tempId = `rc-${Date.now()}`;
  addResumeSkeletonCard(tempId, file.name);

  const fd = new FormData();
  fd.append('file', file);
  setBadge('busy');

  try {
    const res = await fetch(`${API}/parse-resume`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const body = await res.json();
    // body = { message, saved_as, data }
    // body.data = full resume parser response (process_id, extracted_info, etc.)
    const parsed = body.data || {};
    const info = parsed.extracted_info || {};
    const name = info.name || file.name.replace('.pdf', '');

    state.resumes.push({ id: tempId, filename: file.name, name, info, parsed });
    renderResumeCard(tempId, info, parsed, name);
    document.getElementById('resume-action-row').style.display = 'flex';
    updateSidebar();
    toast(`${name} — parsed ✓`, 'success');
    setBadge('ready');
  } catch (e) {
    renderResumeCardError(tempId, file.name, e.message);
    state.resumes = state.resumes.filter(r => r.id !== tempId);
    toast(`Resume upload failed: ${e.message}`, 'error');
    setBadge('error');
  }
}

function addResumeSkeletonCard(id, filename) {
  const list = document.getElementById('resume-list');
  const card = document.createElement('div');
  card.className = 'employee-card loading-card';
  card.id = id;
  card.innerHTML = `
    <div class="ec-skeleton">
      <div class="skeleton-av"></div>
      <div class="skeleton-lines">
        <div class="skel-line skel-lg"></div>
        <div class="skel-line skel-md"></div>
        <div class="skel-line skel-sm"></div>
      </div>
    </div>
    <div class="ec-skeleton-label">Parsing ${escHtml(filename)}…</div>
  `;
  list.appendChild(card);
}

function renderResumeCard(id, info, parsed, name) {
  const list = document.getElementById('resume-list');
  const idx = Array.from(list.children).findIndex(c => c.id === id);
  const color = AVATAR_COLORS[Math.max(0, idx) % AVATAR_COLORS.length];

  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const skills = Array.isArray(info.skills) ? info.skills : [];
  const email = Array.isArray(info.email) ? info.email[0] : (info.email || '');
  const mobile = Array.isArray(info.mobile) ? info.mobile[0] : (info.mobile || '');
  const isFresher = info.is_fresher;
  const expMonths = info.total_experience_in_months || 0;

  // Last/most recent company
  const companies = info.companies || [];
  const latestJob = companies.length > 0 ? companies[companies.length - 1] : null;

  // Education
  const edu = info.education || [];
  const latestEdu = edu.length > 0 ? edu[0] : null;

  // Skills chips (first 8, rest collapsed)
  const visibleSkills = skills.slice(0, 8);
  const hiddenCount = skills.length - visibleSkills.length;

  const skillChips = visibleSkills.map(s =>
    `<span class="skill-chip">${escHtml(s)}</span>`
  ).join('');
  const moreChip = hiddenCount > 0
    ? `<span class="skill-chip skill-more">+${hiddenCount} more</span>`
    : '';

  const card = document.createElement('div');
  card.className = 'employee-card';
  card.id = id;
  card.innerHTML = `
    <div class="ec-header">
      <div class="ec-avatar" style="background:${color}">${initials}</div>
      <div class="ec-identity">
        <div class="ec-name">${escHtml(name)}</div>
        <div class="ec-meta">
          ${email ? `<span class="ec-contact">✉ ${escHtml(email)}</span>` : ''}
          ${mobile ? `<span class="ec-contact">📞 ${escHtml(mobile)}</span>` : ''}
        </div>
      </div>
      <div class="ec-badges">
        ${isFresher ? '<span class="ec-badge fresher">Fresher</span>' : `<span class="ec-badge experienced">${formatExp(expMonths)}</span>`}
        <span class="ec-badge parsed">Parsed ✓</span>
      </div>
      <button class="rc-remove" onclick="removeResume('${id}')">✕</button>
    </div>

    ${latestJob ? `
    <div class="ec-section">
      <span class="ec-section-label">Latest Role</span>
      <div class="ec-job">
        <span class="ec-job-role">${escHtml(latestJob.designation || '')}</span>
        <span class="ec-job-sep">@</span>
        <span class="ec-job-company">${escHtml(latestJob.company_name || '')}</span>
        ${latestJob.total_experience_in_months > 0
          ? `<span class="ec-job-dur">${formatExp(latestJob.total_experience_in_months)}</span>`
          : ''}
      </div>
    </div>` : ''}

    ${latestEdu ? `
    <div class="ec-section">
      <span class="ec-section-label">Education</span>
      <div class="ec-edu">
        <span class="ec-edu-deg">${escHtml(latestEdu.description || '')}</span>
        <span class="ec-edu-sep">·</span>
        <span class="ec-edu-col">${escHtml(latestEdu.college_name || '')}</span>
        ${latestEdu.end_year ? `<span class="ec-edu-yr">'${String(latestEdu.end_year).slice(-2)}</span>` : ''}
      </div>
    </div>` : ''}

    <div class="ec-section">
      <span class="ec-section-label">Skills</span>
      <div class="ec-skills">
        ${skillChips}${moreChip}
        ${skills.length === 0 ? '<span class="ec-no-skills">No skills extracted</span>' : ''}
      </div>
    </div>
  `;

  const old = document.getElementById(id);
  if (old) old.replaceWith(card);
}

function renderResumeCardError(id, filename, errMsg) {
  const card = document.getElementById(id);
  if (!card) return;
  card.className = 'employee-card error-card';
  card.innerHTML = `
    <div class="ec-header">
      <div class="ec-avatar" style="background:rgba(255,85,0,.2);color:var(--orange)">✕</div>
      <div class="ec-identity">
        <div class="ec-name" style="color:var(--orange)">${escHtml(filename)}</div>
        <div class="ec-meta"><span class="ec-contact">${escHtml(errMsg)}</span></div>
      </div>
      <button class="rc-remove" onclick="this.closest('.employee-card').remove()">✕</button>
    </div>
  `;
}

function removeResume(id) {
  state.resumes = state.resumes.filter(r => r.id !== id);
  document.getElementById(id)?.remove();
  updateSidebar();
  if (state.resumes.length === 0) {
    document.getElementById('resume-action-row').style.display = 'none';
  }
}

function formatExp(months) {
  if (!months) return '';
  if (months < 12) return `${months}mo exp`;
  const yr = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yr}y ${mo}mo exp` : `${yr}yr exp`;
}

function extractSkillsString(info) {
  const skills = info.skills;
  if (!skills) return '';
  if (typeof skills === 'string') return skills;
  if (Array.isArray(skills)) return skills.slice(0, 6).join(', ');
  if (typeof skills === 'object') {
    const all = Object.values(skills).flat();
    return all.slice(0, 6).join(', ');
  }
  return '';
}

// ── Generate Crew ─────────────────────────────────────────────────
function updateGeneratePrereqs() {
  const prdMet = !!state.prdData;
  const resumesMet = state.resumes.length > 0;

  const prdEl = document.getElementById('prereq-prd');
  const resumeEl = document.getElementById('prereq-resumes');

  prdEl.classList.toggle('met', prdMet);
  resumeEl.classList.toggle('met', resumesMet);

  document.getElementById('generate-btn').disabled = !(prdMet && resumesMet);
}

async function generateCrew() {
  const btn = document.getElementById('generate-btn');
  setLoading(true, 'Generating CrewAI configuration…');
  setButtonLoading(btn, true);
  setBadge('busy');

  try {
    const res = await fetch(`${API}/crew-generate?output_subdir=output`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    state.crewData = await res.json();
    renderCrewResults(state.crewData);
    markStepDone(3);
    updateSidebar();
    toast('Crew config generated!', 'success');
    setBadge('ready');
  } catch (e) {
    toast(`Generation failed: ${e.message}`, 'error');
    setBadge('error');
  } finally {
    setLoading(false);
    setButtonLoading(btn, false);
  }
}

function renderCrewResults(data) {
  // agents.yaml and tasks.yaml have full content in the response.
  // crew.py and main.py are only written to disk — show their paths.
  const writtenFiles = data.written_files || {};
  const files = {
    'agents.yaml': { content: data.agents_yaml || '', path: writtenFiles['agents.yaml'] },
    'tasks.yaml':  { content: data.tasks_yaml  || '', path: writtenFiles['tasks.yaml'] },
    'crew.py':     { content: null, path: writtenFiles['crew.py'] },
    'main.py':     { content: null, path: writtenFiles['main.py'] },
  };

  const tabsEl = document.getElementById('file-tabs');
  const previewEl = document.getElementById('code-preview');
  tabsEl.innerHTML = '';

  const fileNames = Object.keys(files).filter(n => files[n].path || files[n].content);
  state.activeFileTab = fileNames[0];

  const showFile = (name) => {
    const f = files[name];
    if (f.content) {
      previewEl.textContent = f.content;
      previewEl.className = 'code-preview';
    } else {
      previewEl.textContent = `# Content not returned by API — file written to disk:\n# ${f.path || '(unknown path)'}`;
      previewEl.className = 'code-preview code-path-only';
    }
  };

  fileNames.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'file-tab' + (i === 0 ? ' active' : '');
    btn.textContent = name;
    btn.onclick = () => {
      document.querySelectorAll('.file-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFileTab = name;
      showFile(name);
    };
    tabsEl.appendChild(btn);
  });

  showFile(fileNames[0]);

  // Output dir info
  if (data.output_dir) {
    document.getElementById('generated-at-badge').textContent =
      data.generated_at
        ? new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Generated';
  }

  // New agents
  const newAgents = data.new_agents || [];
  if (newAgents.length > 0) {
    const panel = document.getElementById('new-agents-panel');
    const chips = document.getElementById('na-chips');
    chips.innerHTML = newAgents.map(a =>
      `<span class="na-chip">${escHtml(a)}</span>`
    ).join('');
    panel.style.display = 'flex';
  }

  // Output dir banner
  renderOutputDirBanner(data.output_dir, writtenFiles);

  document.getElementById('crew-results').style.display = 'block';

  // Assignment board — parsed from the returned YAML strings
  renderAssignmentBoard(data.agents_yaml, data.tasks_yaml);
}

function renderOutputDirBanner(outputDir, writtenFiles) {
  // Remove old banner if re-generating
  document.getElementById('output-dir-banner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'output-dir-banner';
  banner.className = 'output-dir-banner';

  const fileList = Object.entries(writtenFiles)
    .map(([name, path]) => `<span class="chip">${escHtml(name)}</span>`)
    .join('');

  banner.innerHTML = `
    <div class="odb-left">
      <span class="odb-icon">📁</span>
      <div>
        <div class="odb-label">Written to disk</div>
        <div class="odb-path">${escHtml(outputDir || '')}</div>
      </div>
    </div>
    <div class="odb-files">${fileList}</div>
  `;

  // Insert before the results panel
  const panel = document.getElementById('crew-results');
  panel.parentNode.insertBefore(banner, panel);
}

// ── Assignment Board ──────────────────────────────────────────────

const AB_COLORS = [
  { bg: 'rgba(255,85,0,.12)',   border: 'rgba(255,85,0,.3)',   text: '#FF5500' },
  { bg: 'rgba(0,223,255,.1)',   border: 'rgba(0,223,255,.25)', text: '#00DFFF' },
  { bg: 'rgba(123,47,255,.12)', border: 'rgba(123,47,255,.3)', text: '#7B2FFF' },
  { bg: 'rgba(0,224,155,.1)',   border: 'rgba(0,224,155,.25)', text: '#00E09B' },
  { bg: 'rgba(255,85,0,.08)',   border: 'rgba(255,85,0,.2)',   text: '#FF8844' },
  { bg: 'rgba(0,223,255,.07)',  border: 'rgba(0,223,255,.18)', text: '#44EEFF' },
];

// Normalize agents YAML into { agentKey: { role, goal, backstory, name? } }
function normalizeAgents(parsed) {
  if (!parsed || typeof parsed !== 'object') return {};

  // New flat format: { engineering_manager: { role, goal, backstory }, ... }
  if (!parsed.agents) return parsed;

  // Old array format: { agents: [{ name, role, goal, backstory }, ...] }
  if (Array.isArray(parsed.agents)) {
    const result = {};
    parsed.agents.forEach(a => {
      const key = (a.name || a.role || 'agent')
        .toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
      result[key] = { ...a };
    });
    return result;
  }
  return parsed;
}

// Normalize tasks YAML into { taskKey: { description, agent, context[], output_file, expected_output } }
function normalizeTasks(parsed) {
  if (!parsed || typeof parsed !== 'object') return {};

  // New flat format: { task_31: { description, agent, context, output_file }, ... }
  if (!parsed.tasks) return parsed;

  // Old array format: { tasks: [{ description, agent, context, output_file }, ...] }
  if (Array.isArray(parsed.tasks)) {
    const result = {};
    parsed.tasks.forEach((t, i) => {
      const key = t.id ? `task_${t.id}` : `task_${i + 1}`;
      result[key] = { ...t };
    });
    return result;
  }
  return parsed;
}

// Map a task's agent field (could be a key or display name) to an agent key
function resolveAgentKey(taskAgentField, agentKeys) {
  if (!taskAgentField) return null;
  const field = String(taskAgentField);
  // Direct key match
  if (agentKeys.includes(field)) return field;
  // Try lowercase/underscore match
  const normalised = field.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
  const found = agentKeys.find(k => k === normalised ||
    k.toLowerCase().replace(/[^\w]/g, '') === normalised.replace(/[^\w]/g, ''));
  return found || field; // return raw value if no match (will create orphan column)
}

let abView = 'board';
let abBoardData = null; // { agents, tasks, byAgent }

function setAbView(view) {
  abView = view;
  document.getElementById('avt-board').classList.toggle('active', view === 'board');
  document.getElementById('avt-list').classList.toggle('active', view === 'list');
  document.getElementById('ab-columns').style.display = view === 'board' ? 'flex' : 'none';
  document.getElementById('ab-list').style.display   = view === 'list'  ? 'block' : 'none';
}

function renderAssignmentBoard(agentsYamlStr, tasksYamlStr) {
  const board = document.getElementById('assignment-board');
  board.style.display = 'none';

  if (!agentsYamlStr || !tasksYamlStr) return;

  let agentsParsed, tasksParsed;
  try {
    agentsParsed = jsyaml.load(agentsYamlStr);
    tasksParsed  = jsyaml.load(tasksYamlStr);
  } catch (e) {
    console.warn('YAML parse error:', e);
    return;
  }

  const agents = normalizeAgents(agentsParsed);
  const tasks  = normalizeTasks(tasksParsed);

  const agentKeys = Object.keys(agents);
  const taskEntries = Object.entries(tasks);

  // Group tasks by resolved agent key, preserving insertion order
  const byAgent = {};
  // Pre-populate with known agents so column order matches agents.yaml
  agentKeys.forEach(k => { byAgent[k] = []; });

  taskEntries.forEach(([taskKey, task]) => {
    const agentKey = resolveAgentKey(task.agent, agentKeys);
    if (!byAgent[agentKey]) byAgent[agentKey] = [];
    byAgent[agentKey].push({ key: taskKey, ...task });
  });

  abBoardData = { agents, tasks, byAgent };

  // Badge
  document.getElementById('ab-badge').textContent =
    `${taskEntries.length} task${taskEntries.length !== 1 ? 's' : ''} · ${Object.keys(byAgent).length} agent${Object.keys(byAgent).length !== 1 ? 's' : ''}`;

  renderBoardColumns(byAgent, agents);
  renderListView(byAgent, agents);

  board.style.display = 'block';
}

function agentDisplayName(key, agent) {
  // Prefer the name field (old format), else format the key
  if (agent.name && agent.name.toLowerCase() !== 'not available') return agent.name;
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderBoardColumns(byAgent, agents) {
  const cols = document.getElementById('ab-columns');
  cols.innerHTML = '';

  Object.entries(byAgent).forEach(([agentKey, agentTasks], colIdx) => {
    const agent = agents[agentKey] || {};
    const color = AB_COLORS[colIdx % AB_COLORS.length];
    const name  = agentDisplayName(agentKey, agent);
    const role  = agent.role || agentKey.replace(/_/g, ' ');
    const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const col = document.createElement('div');
    col.className = 'ab-col';
    col.innerHTML = `
      <div class="ab-agent-header" style="border-color:${color.border}">
        <div class="ab-av" style="background:${color.bg};border:1px solid ${color.border};color:${color.text}">${initials}</div>
        <div class="ab-agent-meta">
          <div class="ab-agent-name">${escHtml(name)}</div>
          <div class="ab-agent-role">${escHtml(role)}</div>
        </div>
        <span class="ab-count" style="background:${color.bg};color:${color.text}">${agentTasks.length}</span>
      </div>
      <div class="ab-task-stack" id="stack-${agentKey}"></div>
    `;
    cols.appendChild(col);

    const stack = col.querySelector('.ab-task-stack');
    agentTasks.forEach((task, taskIdx) =>
      stack.appendChild(buildTaskCard(task, color, taskIdx))
    );

    if (agentTasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ab-empty';
      empty.textContent = 'No tasks assigned';
      stack.appendChild(empty);
    }
  });
}

function buildTaskCard(task, color, idx) {
  const card = document.createElement('div');
  card.className = 'ab-task-card';

  const context = Array.isArray(task.context) ? task.context : [];
  const outputFile = task.output_file || task.output_file || '';
  const filename = outputFile ? outputFile.split('/').pop() : '';
  const cardId = `abt-${task.key}-${idx}`;

  card.innerHTML = `
    <div class="abt-top">
      <span class="abt-key" style="color:${color.text}">${escHtml(task.key)}</span>
      ${filename ? `<span class="abt-file" title="${escHtml(outputFile)}">${escHtml(filename)}</span>` : ''}
    </div>
    <div class="abt-desc" id="${cardId}-desc">${escHtml(task.description || '')}</div>
    ${task.expected_output ? `<div class="abt-expected"><span class="abt-exp-label">Output:</span> ${escHtml(task.expected_output)}</div>` : ''}
    ${context.length > 0 ? `
    <div class="abt-deps">
      <span class="abt-deps-label">Depends on</span>
      ${context.map(c => `<span class="abt-dep-chip">${escHtml(String(c))}</span>`).join('')}
    </div>` : ''}
  `;
  return card;
}

function renderListView(byAgent, agents) {
  const list = document.getElementById('ab-list');
  list.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'ab-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Task</th>
        <th>Agent</th>
        <th>Description</th>
        <th>Depends On</th>
        <th>Output File</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');

  Object.entries(byAgent).forEach(([agentKey, agentTasks], colIdx) => {
    const agent = agents[agentKey] || {};
    const color = AB_COLORS[colIdx % AB_COLORS.length];
    const name  = agentDisplayName(agentKey, agent);

    agentTasks.forEach(task => {
      const context = Array.isArray(task.context) ? task.context : [];
      const outputFile = task.output_file || '';
      const filename = outputFile ? outputFile.split('/').pop() : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="abt-key" style="color:${color.text}">${escHtml(task.key)}</span></td>
        <td>
          <span class="abt-agent-pill" style="background:${color.bg};border-color:${color.border};color:${color.text}">
            ${escHtml(name)}
          </span>
        </td>
        <td class="abt-desc-cell">${escHtml(task.description || '')}</td>
        <td>${context.length ? context.map(c => `<span class="abt-dep-chip">${escHtml(String(c))}</span>`).join('') : '<span style="color:var(--muted)">—</span>'}</td>
        <td><code class="abt-file">${escHtml(filename)}</code></td>
      `;
      tbody.appendChild(tr);
    });
  });

  table.appendChild(tbody);
  list.appendChild(table);
}

// ── Run Crew (streaming) ──────────────────────────────────────────
async function runCrew() {
  const btn = document.getElementById('run-btn');
  setButtonLoading(btn, true);
  setBadge('busy');

  const logPanel  = document.getElementById('log-panel');
  const logOutput = document.getElementById('log-output');
  const logStatus = document.getElementById('log-status');

  logPanel.style.display = 'block';
  logOutput.textContent  = '';
  logStatus.textContent  = 'Starting…';
  logStatus.className    = 'log-status running';

  // Scroll log to bottom helper
  const scrollLog = () => { logOutput.scrollTop = logOutput.scrollHeight; };

  const appendLog = (line, cls = '') => {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = line + '\n';
    logOutput.appendChild(span);
    scrollLog();
  };

  try {
    const res = await fetch(`${API}/crew-run-stream`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const events = buffer.split('\n\n');
      buffer = events.pop(); // last element may be incomplete

      for (const raw of events) {
        const dataLine = raw.replace(/^data: /, '').trim();
        if (!dataLine) continue;

        let evt;
        try { evt = JSON.parse(dataLine); } catch { continue; }

        if (evt.type === 'status') {
          logStatus.textContent = evt.line;
          appendLog(`── ${evt.line}`, 'log-phase');

        } else if (evt.type === 'log') {
          const cls = evt.stream === 'build' ? 'log-build' : '';
          appendLog(evt.line, cls);

        } else if (evt.type === 'done') {
          logStatus.textContent = 'Completed ✓';
          logStatus.className   = 'log-status success';
          if (evt.line) {
            document.getElementById('download-btn').style.display = 'inline-flex';
          }
          markStepDone(4);
          toast('Crew run complete!', 'success');
          setBadge('ready');

        } else if (evt.type === 'error') {
          logStatus.textContent = 'Failed';
          logStatus.className   = 'log-status error';
          appendLog(`✕ ${evt.line}`, 'log-err');
          toast(`Run failed: ${evt.line}`, 'error');
          setBadge('error');
        }
      }
    }
  } catch (e) {
    logStatus.textContent = 'Failed';
    logStatus.className   = 'log-status error';
    appendLog(`✕ ${e.message}`, 'log-err');
    toast(`Run failed: ${e.message}`, 'error');
    setBadge('error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ── Drag & Drop helper ────────────────────────────────────────────
function setupDragDrop(zoneId, inputId, acceptedTypes, callback) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (acceptedTypes.length && !acceptedTypes.some(t => file.type === t || file.name.endsWith(t.split('/')[1]))) {
      toast('Unsupported file type.', 'error');
      return;
    }
    if (zoneId === 'prd-dropzone') {
      onPRDFileSelect(file);
    } else {
      callback(file);
    }
  });
}

// ── UI Helpers ────────────────────────────────────────────────────
function setLoading(show, msg = 'Processing…') {
  const overlay = document.getElementById('loading-overlay');
  document.getElementById('loading-msg').textContent = msg;
  overlay.style.display = show ? 'flex' : 'none';
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

function setBadge(state) {
  const badge = document.getElementById('status-badge');
  const map = {
    ready: ['● Ready', ''],
    busy:  ['◌ Working…', 'busy'],
    error: ['✕ Error', 'error'],
  };
  const [text, cls] = map[state] || map.ready;
  badge.textContent = text;
  badge.className = `app-nav-badge ${cls}`;
}

function toast(msg, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span>${escHtml(msg)}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut .3s var(--ease) forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
