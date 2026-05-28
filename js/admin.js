/* ===== GANDDAL PORTAL – ADMIN.JS ===== */

const STORAGE_KEY_HASH = 'ganddal_admin_hash';
const STORAGE_KEY_SESSION = 'ganddal_admin_sess';

let adminData = null;
let editingIndex = null;

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
async function loadData() {
  try {
    const res = await fetch('data.json?_=' + Date.now());
    adminData = await res.json();
    renderTable();
    populateCategories();
    populateAgeGroups();
  } catch (err) {
    showToast('Feil ved lasting av data.json', 'error');
    console.error(err);
  }
}

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

/* ─── Rendr organisasjonstabell ─── */
function renderTable() {
  const tbody = document.getElementById('orgTableBody');
  if (!tbody || !adminData?.organizations) return;
  if (adminData.organizations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:2rem">Ingen organisasjoner lagt til ennå</td></tr>';
    return;
  }
  tbody.innerHTML = adminData.organizations.map((org, i) => `
    <tr class="${org.active === false ? 'inactive-row' : ''}">
      <td><strong>${esc(org.name)}</strong></td>
      <td>${esc(org.category)}</td>
      <td><a href="${esc(org.url)}" target="_blank" rel="noopener">${getDomain(org.url)}</a></td>
      <td><span class="status-dot ${org.active !== false ? 'active' : 'inactive'}"></span> ${org.active !== false ? 'Aktiv' : 'Skjult'}</td>
      <td>${org.featured ? '⭐' : '–'}</td>
      <td style="display:flex;gap:.4rem;align-items:center">
        <button class="btn-sm btn-edit" onclick="openEditModal(${i})">Rediger</button>
        <button class="btn-sm btn-delete" onclick="deleteOrg(${i})">Slett</button>
      </td>
    </tr>
  `).join('');
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
      : new Date().toISOString().slice(0, 10)
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
