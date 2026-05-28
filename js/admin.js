/* ===== GANDDAL PORTAL – ADMIN.JS ===== */

const STORAGE_KEY_HASH = 'ganddal_admin_hash';
const STORAGE_KEY_SESSION = 'ganddal_admin_sess';

let adminData    = null;
let editingIndex = null;
let sortCol      = null;   // null = standardsortering
let sortDir      = 'asc';

/* ─── SHA-256 hashing ─── */
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ─── Seksjonshåndtering ─── */
function show(id) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  // Logg ut-knapp vises kun når panelet er aktivt
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = id === 'panel' ? '' : 'none';
}

/* ─── Init ─── */
async function init() {
  if (sessionStorage.getItem(STORAGE_KEY_SESSION) === 'yes') {
    show('panel');
    await loadData();
    return;
  }
  const hash = localStorage.getItem(STORAGE_KEY_HASH);
  show(hash ? 'login' : 'setup');
}

/* ─── Oppsettskjema (første gang) ─── */
document.getElementById('setupForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const pw = document.getElementById('setupPw').value;
  const pw2 = document.getElementById('setupPw2').value;
  const errEl = document.getElementById('setupError');
  errEl.textContent = '';
  if (pw !== pw2) { errEl.textContent = 'Passordene er ikke like.'; return; }
  if (pw.length < 6) { errEl.textContent = 'Passordet må være minst 6 tegn.'; return; }
  localStorage.setItem(STORAGE_KEY_HASH, await sha256(pw));
  show('login');
  document.getElementById('loginError').textContent = 'Passord opprettet. Logg inn.';
});

/* ─── Innloggingsskjema ─── */
document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const pw = document.getElementById('loginPw').value;
  const stored = localStorage.getItem(STORAGE_KEY_HASH);
  const errEl = document.getElementById('loginError');
  const entered = await sha256(pw);
  if (entered === stored) {
    sessionStorage.setItem(STORAGE_KEY_SESSION, 'yes');
    show('panel');
    await loadData();
  } else {
    errEl.textContent = 'Feil passord.';
  }
});

/* ─── Logg ut ─── */
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
  location.reload();
});

/* ─── Endre passord ─── */
document.getElementById('changePwForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const newPw = document.getElementById('newPw').value;
  const newPw2 = document.getElementById('newPw2').value;
  const errEl = document.getElementById('changePwError');
  errEl.textContent = '';
  if (newPw !== newPw2) { errEl.textContent = 'Passordene er ikke like.'; return; }
  if (newPw.length < 6) { errEl.textContent = 'Minst 6 tegn.'; return; }
  localStorage.setItem(STORAGE_KEY_HASH, await sha256(newPw));
  showToast('Passord endret!', 'success');
  e.target.reset();
});

/* ─── Last inn data ─── */
const EMPTY_DATA = {
  meta: { lastUpdated: new Date().toISOString().slice(0, 10), version: '1.0' },
  categories: ['Idrett og kultur', 'Skole, helse og omsorg', 'Handel og service', 'Offentlig og frivillig'],
  ageGroups: [
    { id: 'barn',     label: 'Barn (0–12 år)' },
    { id: 'ungdom',   label: 'Ungdom (13–19 år)' },
    { id: 'voksne',   label: 'Voksne (20–64 år)' },
    { id: 'eldre',    label: 'Eldre (65+)' },
    { id: 'foreldre', label: 'Foreldre' },
    { id: 'familier', label: 'Familier' }
  ],
  organizations: [],
  suggestions: []
};

async function fetchWithTimeout(url, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function loadData() {
  const tbody = document.getElementById('orgTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:2rem">Laster inn data…</td></tr>';

  try {
    const res = await fetchWithTimeout('data.json?_=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    adminData = await res.json();
  } catch (err) {
    console.warn('Kunne ikke laste data.json – bruker tom start:', err);
    adminData = JSON.parse(JSON.stringify(EMPTY_DATA));
    if (tbody) tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:2rem">
        <p style="color:#DC2626;margin-bottom:1rem">⚠️ Kunne ikke laste data.json.<br>
        Du kan importere en eksisterende datafil eller begynne med blanke ark.</p>
        <label class="btn-secondary" style="cursor:pointer;display:inline-block;padding:.5rem 1rem">
          📂 Importer data.json fra fil
          <input type="file" accept=".json" style="display:none" onchange="importFile(this)">
        </label>
      </td></tr>`;
    showToast('Starter med tom liste – importer data.json hvis du har en', 'error');
    populateCategories();
    populateAgeGroups();
    return;
  }

  renderTable();
  populateCategories();
  populateAgeGroups();
}

/* ─── Importer data.json fra lokal fil ─── */
function importFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      adminData = JSON.parse(e.target.result);
      renderTable();
      populateCategories();
      populateAgeGroups();
      showToast('Datafil importert!', 'success');
    } catch {
      showToast('Ugyldig JSON-fil', 'error');
    }
  };
  reader.readAsText(file);
}
window.importFile = importFile;

/* ─── Fyll inn kategorier og aldersgrupper i skjema ─── */
function populateCategories() {
  const sel = document.getElementById('orgCategory');
  if (!sel || !adminData?.categories) return;
  sel.innerHTML = adminData.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function populateAgeGroups() {
  const container = document.getElementById('orgAgeGroups');
  if (!container || !adminData?.ageGroups) return;
  container.innerHTML = adminData.ageGroups.map(ag =>
    `<label class="checkbox-label">
      <input type="checkbox" name="ageGroup" value="${esc(ag.id)}">
      ${esc(ag.label)}
    </label>`
  ).join('');
}

/* ─── Sorteringshjelpere ─── */
function daysVisible(org) {
  const d = org.addedDate ? new Date(org.addedDate) : null;
  if (!d || isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d) / 86400000));
}

function sortValue(org, col) {
  switch (col) {
    case 'name':     return (org.name || '').toLowerCase();
    case 'category': return (org.category || '').toLowerCase();
    case 'status':   return org.active !== false ? 0 : 1;
    case 'featured': return org.featured ? 0 : 1;
    case 'days':     return daysVisible(org);
    default:         return '';
  }
}

function sortedOrgs() {
  const orgs = adminData?.organizations ?? [];
  return [...orgs].sort((a, b) => {
    if (sortCol === null) {
      // Standard: fremhevet øverst, deretter navn A–Å
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '', 'no');
    }
    const va = sortValue(a, sortCol);
    const vb = sortValue(b, sortCol);
    const cmp = typeof va === 'string'
      ? va.localeCompare(vb, 'no')
      : va - vb;
    return sortDir === 'desc' ? -cmp : cmp;
  });
}

function updateSortHeaders() {
  document.querySelectorAll('th[data-col]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

/* ─── Klikk på kolonneoverskrift ─── */
document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
    updateSortHeaders();
    renderTable();
  });
});

/* ─── Rendr organisasjonstabell ─── */
function renderTable() {
  const tbody = document.getElementById('orgTableBody');
  if (!tbody || !adminData?.organizations) return;
  if (adminData.organizations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9CA3AF;padding:2rem">Ingen organisasjoner lagt til ennå</td></tr>';
    return;
  }
  // Finn reell indeks (sortering endrer rekkefølge, men vi redigerer på original-indeks)
  const sorted = sortedOrgs();
  tbody.innerHTML = sorted.map(org => {
    const i = adminData.organizations.indexOf(org);
    const days = daysVisible(org);
    const daysLabel = days === 0 ? 'I dag' : days === 1 ? '1 dag' : `${days} dager`;
    return `
    <tr class="${org.active === false ? 'inactive-row' : ''}">
      <td><strong>${esc(org.name)}</strong></td>
      <td>${esc(org.category)}</td>
      <td><a href="${esc(org.url)}" target="_blank" rel="noopener">${getDomain(org.url)}</a></td>
      <td><span class="status-dot ${org.active !== false ? 'active' : 'inactive'}"></span> ${org.active !== false ? 'Aktiv' : 'Skjult'}</td>
      <td>${org.featured ? '⭐' : '–'}</td>
      <td style="white-space:nowrap;color:#6B7280;font-size:.85rem">${daysLabel}</td>
      <td style="display:flex;gap:.4rem;align-items:center">
        <button class="btn-sm btn-edit" onclick="openEditModal(${i})">Rediger</button>
        <button class="btn-sm btn-delete" onclick="deleteOrg(${i})">Slett</button>
      </td>
    </tr>`;
  }).join('');
  updateSortHeaders();
}

/* ─── Tabvelger ─── */
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById('tab-' + tab.dataset.tab);
    if (target) target.classList.add('active');
  });
});

/* ─── Legg til / Rediger modal ─── */
function openAddModal() {
  editingIndex = null;
  document.getElementById('modalTitle').textContent = 'Legg til ny';
  document.getElementById('orgForm').reset();
  document.querySelectorAll('#orgAgeGroups input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('orgActive').checked = true;
  document.getElementById('orgFeatured').checked = false;
  openModal();
}
window.openAddModal = openAddModal;

function openEditModal(index) {
  editingIndex = index;
  const org = adminData.organizations[index];
  document.getElementById('modalTitle').textContent = 'Rediger';
  document.getElementById('orgName').value = org.name || '';
  document.getElementById('orgUrl').value = org.url || '';
  document.getElementById('orgDescription').value = org.description || '';
  document.getElementById('orgCategory').value = org.category || '';
  document.getElementById('orgLogo').value = org.logo || '';
  document.getElementById('orgTags').value = (org.tags || []).join(', ');
  document.getElementById('orgActive').checked = org.active !== false;
  document.getElementById('orgFeatured').checked = org.featured === true;
  document.querySelectorAll('#orgAgeGroups input[type=checkbox]').forEach(cb => {
    cb.checked = (org.ageGroups || []).includes(cb.value);
  });
  openModal();
}
window.openEditModal = openEditModal;

function openModal() { document.getElementById('orgModal').classList.add('open'); }
function closeModal() { document.getElementById('orgModal').classList.remove('open'); }
document.getElementById('modalClose')?.addEventListener('click', closeModal);
document.getElementById('modalCancel')?.addEventListener('click', closeModal);
document.getElementById('orgModal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('orgModal')) closeModal();
});

/* ─── Hent OG-data fra URL ─── */
document.getElementById('fetchMetaBtn')?.addEventListener('click', async () => {
  const url = document.getElementById('orgUrl').value.trim();
  if (!url) { showToast('Skriv inn en nettadresse først', 'error'); return; }
  const btn = document.getElementById('fetchMetaBtn');
  btn.disabled = true;
  btn.textContent = 'Henter...';
  try {
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`;
    const res = await fetch(apiUrl);
    const json = await res.json();
    if (json.status === 'success') {
      const { title, description, logo, image } = json.data;
      if (title && !document.getElementById('orgName').value)
        document.getElementById('orgName').value = title;
      if (description && !document.getElementById('orgDescription').value)
        document.getElementById('orgDescription').value = description;
      const logoUrl = logo?.url || image?.url;
      if (logoUrl && !document.getElementById('orgLogo').value)
        document.getElementById('orgLogo').value = logoUrl;
      showToast('Info hentet!', 'success');
    } else {
      showToast('Kunne ikke hente info fra URL', 'error');
    }
  } catch {
    showToast('Nettverksfeil – sjekk at URL er gyldig', 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Hent info fra URL';
});

/* ─── Lagre organisasjon ─── */
document.getElementById('orgForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const ageGroups = [...document.querySelectorAll('#orgAgeGroups input[type=checkbox]:checked')].map(cb => cb.value);
  const rawTags = document.getElementById('orgTags').value;
  const org = {
    id: editingIndex !== null
      ? adminData.organizations[editingIndex].id
      : slugify(document.getElementById('orgName').value),
    name:        document.getElementById('orgName').value.trim(),
    url:         document.getElementById('orgUrl').value.trim(),
    description: document.getElementById('orgDescription').value.trim(),
    category:    document.getElementById('orgCategory').value,
    logo:        document.getElementById('orgLogo').value.trim() || null,
    tags:        rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [],
    ageGroups,
    active:      document.getElementById('orgActive').checked,
    featured:    document.getElementById('orgFeatured').checked,
    addedDate:   editingIndex !== null
      ? adminData.organizations[editingIndex].addedDate
      : new Date().toISOString().slice(0, 10),
    updatedDate: new Date().toISOString().slice(0, 10)
  };

  if (!org.name || !org.url || !org.category) {
    showToast('Navn, URL og kategori er påkrevd', 'error');
    return;
  }

  if (editingIndex !== null) {
    adminData.organizations[editingIndex] = org;
    showToast('Oppdatert!', 'success');
  } else {
    adminData.organizations.push(org);
    showToast('Lagt til!', 'success');
  }

  adminData.meta.lastUpdated = new Date().toISOString().slice(0, 10);
  closeModal();
  renderTable();
});

/* ─── Slett ─── */
function deleteOrg(index) {
  const name = adminData.organizations[index].name;
  if (!confirm(`Slett «${name}»? Dette kan ikke angres.`)) return;
  adminData.organizations.splice(index, 1);
  adminData.meta.lastUpdated = new Date().toISOString().slice(0, 10);
  renderTable();
  showToast('Slettet', 'success');
}
window.deleteOrg = deleteOrg;

/* ─── Last ned data.json ─── */
document.getElementById('downloadBtn')?.addEventListener('click', () => {
  if (!adminData) return;
  const json = JSON.stringify(adminData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('data.json lastet ned – last den opp til GitHub', 'success');
});

/* ─── Hjelpefunksjoner ─── */
function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ─── Toast-melding ─── */
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ─── Start ─── */
document.addEventListener('DOMContentLoaded', init);
