/* ===== GANDDAL PORTAL – PORTAL.JS ===== */

const CAT_CONFIG = {
  'Idrett og kultur':       { color: '#2563EB', bg: '#DBEAFE', emoji: '⚽' },
  'Skole, helse og omsorg': { color: '#059669', bg: '#D1FAE5', emoji: '🏥' },
  'Handel og service':      { color: '#D97706', bg: '#FEF3C7', emoji: '🛒' },
  'Offentlig og frivillig': { color: '#7C3AED', bg: '#EDE9FE', emoji: '🏛️' }
};

let allOrgs = [];
let filteredOrgs = [];
let activeCategory = 'all';
let activeAge = 'all';
let searchQuery = '';
let portalData = null;

/* ─── Init ─── */
async function init(ageFilter) {
  try {
    const res = await fetch('data.json?_=' + Date.now());
    portalData = await res.json();
    allOrgs = portalData.organizations.filter(o => o.active !== false);
    filteredOrgs = allOrgs;

    if (ageFilter) activeAge = ageFilter;

    buildCategoryFilters();
    buildAgeFilters();
    setupSearch();
    applyFilters();
  } catch (err) {
    console.error('Feil ved lasting av data.json:', err);
    const grid = document.getElementById('cardsGrid');
    if (grid) grid.innerHTML = '<p style="color:#C53030;padding:2rem">Kunne ikke laste innhold.</p>';
  }
}

/* ─── Filter-bygging ─── */
function buildCategoryFilters() {
  const container = document.getElementById('categoryFilters');
  if (!container || !portalData) return;
  const cats = ['all', ...portalData.categories];
  container.innerHTML = cats.map(cat =>
    `<button class="chip${cat === activeCategory ? ' active' : ''}" data-category="${cat}">
      ${cat === 'all' ? 'Alle kategorier' : cat}
    </button>`
  ).join('');
  container.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategory = chip.dataset.category;
    applyFilters();
  });
}

function buildAgeFilters() {
  const container = document.getElementById('ageFilters');
  if (!container || !portalData) return;
  const ages = [{ id: 'all', label: 'Alle aldre' }, ...portalData.ageGroups];
  container.innerHTML = ages.map(ag =>
    `<button class="chip${ag.id === activeAge ? ' active' : ''}" data-age="${ag.id}">
      ${ag.label}
    </button>`
  ).join('');
  container.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeAge = chip.dataset.age;
    applyFilters();
  });
}

/* ─── Søk ─── */
function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  const doSearch = debounce(() => {
    searchQuery = input.value.toLowerCase().trim();
    applyFilters();
  }, 180);
  input.addEventListener('input', doSearch);
  const heroInput = document.getElementById('heroSearchInput');
  if (heroInput) {
    heroInput.addEventListener('input', debounce(() => {
      searchQuery = heroInput.value.toLowerCase().trim();
      if (input) input.value = heroInput.value;
      applyFilters();
    }, 180));
    heroInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        document.querySelector('.filters-wrap')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ─── Filtrering ─── */
function applyFilters() {
  filteredOrgs = allOrgs.filter(org => {
    const matchCat = activeCategory === 'all' || org.category === activeCategory;
    const matchAge = activeAge === 'all' || (org.ageGroups || []).includes(activeAge);
    const matchSearch = !searchQuery || [
      org.name, org.description, ...(org.tags || [])
    ].some(s => s?.toLowerCase().includes(searchQuery));
    return matchCat && matchAge && matchSearch;
  });
  renderCards();
  updateResultsBar();
}

/* ─── Resultatinfo ─── */
function updateResultsBar() {
  const el = document.getElementById('resultsCount');
  if (!el) return;
  if (filteredOrgs.length === allOrgs.length) {
    el.innerHTML = `Viser alle <strong>${allOrgs.length}</strong> tilbud`;
  } else {
    el.innerHTML = `<strong>${filteredOrgs.length}</strong> av ${allOrgs.length} tilbud`;
  }
}

/* ─── Rendr kort ─── */
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  const empty = document.getElementById('emptyState');
  if (!grid) return;

  if (filteredOrgs.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...filteredOrgs].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return a.name.localeCompare(b.name, 'no');
  });

  grid.innerHTML = sorted.map(renderCard).join('');
  setupScreenshotObserver();
}

function renderCard(org) {
  const cfg = CAT_CONFIG[org.category] || { color: '#6B7280', bg: '#F3F4F6', emoji: '🔗' };
  const faviconUrl = getFaviconUrl(org);
  const domain = getDomain(org.url);
  const ages = (org.ageGroups || [])
    .map(id => portalData?.ageGroups?.find(a => a.id === id)?.label?.split(' ')[0] || id)
    .slice(0, 4);

  return `
<article class="card" data-site-url="${escHtml(org.url)}" data-org-id="${escHtml(org.id)}"
  role="button" tabindex="0" aria-label="Vis detaljer om ${escHtml(org.name)}">
  <div class="card-image" style="background:${cfg.bg}">
    <div class="card-screenshot" aria-hidden="true"></div>
    <div class="card-favicon-wrap">
      <img src="${faviconUrl}"
           alt="${escHtml(org.name)}"
           loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span class="card-favicon-emoji" style="display:none">${cfg.emoji}</span>
    </div>
    ${org.featured ? '<span class="card-featured-badge">⭐ Anbefalt</span>' : ''}
  </div>
  <div class="card-body">
    <span class="card-category-badge" style="color:${cfg.color};background:${cfg.bg}">${org.category}</span>
    <h3 class="card-name">${escHtml(org.name)}</h3>
    <p class="card-description">${escHtml(org.description)}</p>
    ${ages.length ? `<div class="card-ages">${ages.map(l => `<span class="age-tag">${escHtml(l)}</span>`).join('')}</div>` : ''}
  </div>
  <div class="card-footer">
    <span class="card-domain">${escHtml(domain)}</span>
    <span class="card-arrow">→</span>
  </div>
</article>`;
}

/* ─── Detaljmodal ─── */
function ensureOrgModal() {
  if (document.getElementById('orgDetailModal')) return;

  const el = document.createElement('div');
  el.className = 'portal-modal-overlay';
  el.id = 'orgDetailModal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'pmodalName');
  el.innerHTML = `
    <div class="portal-modal">
      <button class="portal-modal-close" id="pmodalClose" aria-label="Lukk">✕</button>
      <div class="pmodal-image" id="pmodalImage">
        <div class="pmodal-favicon-wrap">
          <img id="pmodalLogo" src="" alt=""
            onerror="this.style.display='none';document.getElementById('pmodalEmoji').style.display='flex'">
          <span class="card-favicon-emoji" id="pmodalEmoji" style="display:none"></span>
        </div>
      </div>
      <div class="pmodal-body">
        <span id="pmodalCatBadge" class="card-category-badge" style="margin-bottom:.5rem"></span>
        <h2 id="pmodalName" class="pmodal-name"></h2>
        <p id="pmodalDesc" class="pmodal-desc"></p>
        <div id="pmodalAges" class="card-ages" style="margin-top:.75rem"></div>
        <div id="pmodalTags" class="pmodal-tags"></div>
      </div>
      <div class="pmodal-footer">
        <span id="pmodalDomain" class="card-domain"></span>
        <a id="pmodalVisitBtn" href="#" target="_blank" rel="noopener" class="btn-primary pmodal-visit-btn">
          Besøk nettstedet →
        </a>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById('pmodalClose').addEventListener('click', closeOrgModal);
  el.addEventListener('click', e => { if (e.target === el) closeOrgModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOrgModal(); });
}

function openOrgModal(org) {
  ensureOrgModal();
  const cfg = CAT_CONFIG[org.category] || { color: '#6B7280', bg: '#F3F4F6', emoji: '🔗' };

  document.getElementById('pmodalImage').style.background = cfg.bg;
  const logo = document.getElementById('pmodalLogo');
  logo.src = getFaviconUrl(org);
  logo.alt = org.name;
  logo.style.display = '';
  const emoji = document.getElementById('pmodalEmoji');
  emoji.textContent = cfg.emoji;
  emoji.style.display = 'none';

  const badge = document.getElementById('pmodalCatBadge');
  badge.textContent = org.category;
  badge.style.color = cfg.color;
  badge.style.background = cfg.bg;

  document.getElementById('pmodalName').textContent = org.name;
  document.getElementById('pmodalDesc').textContent = org.description || '';
  document.getElementById('pmodalDomain').textContent = getDomain(org.url);

  const visitBtn = document.getElementById('pmodalVisitBtn');
  visitBtn.href = org.url;

  const ageContainer = document.getElementById('pmodalAges');
  const ageLabels = (org.ageGroups || [])
    .map(id => portalData?.ageGroups?.find(a => a.id === id)?.label || id);
  ageContainer.innerHTML = ageLabels.length
    ? ageLabels.map(l => `<span class="age-tag">${escHtml(l)}</span>`).join('')
    : '';

  const tagContainer = document.getElementById('pmodalTags');
  const tags = (org.tags || []).filter(Boolean);
  tagContainer.innerHTML = tags.length
    ? `<div class="pmodal-tag-row">${tags.map(t => `<span class="pmodal-tag">#${escHtml(t)}</span>`).join('')}</div>`
    : '';

  const overlay = document.getElementById('orgDetailModal');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('pmodalClose').focus();
}

function closeOrgModal() {
  const overlay = document.getElementById('orgDetailModal');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ─── Skjermbildelasting (lazy via IntersectionObserver) ─── */
function setupScreenshotObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const url = card.dataset.siteUrl;
      const el = card.querySelector('.card-screenshot');
      if (el && url && !el.dataset.loaded) {
        el.dataset.loaded = '1';
        const screenshotUrl = `https://image.thum.io/get/width/560/crop/370/${url}`;
        const img = new Image();
        img.onload = () => {
          el.style.backgroundImage = `url('${screenshotUrl}')`;
          el.classList.add('loaded');
        };
        img.src = screenshotUrl;
      }
      observer.unobserve(card);
    });
  }, { rootMargin: '400px' });

  document.querySelectorAll('.card[data-site-url]').forEach(c => observer.observe(c));
}

/* ─── Hjelpefunksjoner ─── */
function getFaviconUrl(org) {
  if (org.logo) return org.logo;
  const domain = getDomain(org.url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}
function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Mobil-meny ─── */
function setupMobileMenu() {
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('mobileMenu');
  const close = document.getElementById('menuClose');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => menu.classList.add('open'));
  close?.addEventListener('click', () => menu.classList.remove('open'));
  menu.addEventListener('click', e => { if (e.target === menu) menu.classList.remove('open'); });
}

/* ─── Forslagsform ─── */
function setupSuggestForm() {
  const form = document.getElementById('suggestForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Sender...';
    const data = new FormData(form);
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        form.parentElement.innerHTML = '<div class="form-success">Takk for forslaget! Vi vurderer det og legger det til om det passer.</div>';
      } else {
        throw new Error('server');
      }
    } catch {
      btn.disabled = false;
      btn.textContent = 'Send forslag';
      alert('Noe gikk galt. Prøv igjen eller send en e-post direkte.');
    }
  });
}

/* ─── Kortklikk (event delegation) ─── */
function setupCardClicks() {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;
  const handle = e => {
    const card = e.target.closest('.card[data-org-id]');
    if (!card) return;
    // Ikke åpne modal dersom brukeren klikker på «Besøk»-lenken inni modalen
    const org = allOrgs.find(o => o.id === card.dataset.orgId);
    if (org) openOrgModal(org);
  };
  grid.addEventListener('click', handle);
  grid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') handle(e);
  });
}

/* ─── Start ─── */
document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  setupSuggestForm();
  setupCardClicks();
  const ageFilter = document.body.dataset.ageFilter || null;
  init(ageFilter);
});
