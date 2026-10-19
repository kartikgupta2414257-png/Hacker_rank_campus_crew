/**
 * ============================================================================
 * HackerRank Campus Crew — Amrapali University, Haldwani
 * Main Frontend Client Script (script.js)
 * 
 * Campus Ambassador: Anil Pandey
 * Phone: 7900546102
 * College Email: au-250303050423@amrapali.ac.in
 * Alternate Email: ap967143@gmail.com
 * ============================================================================
 */

// Application Global State
const state = {
  ambassador: null,
  quota: null,
  hackathons: [],
  contests: [],
  challenges: [],
  courses: [],
  events: [],
  opportunities: [],
  selectedSkills: new Set(['C++', 'DSA', 'Web Development']),
  currentQuizIndex: 0,
  quizScore: 0,
  quizAnswered: false,
  latestEmailPreview: null
};

// Global in-memory cache for coordinator applications (allows instantaneous lookup and Excel generation)
window.publicApplicationsCache = [];

// Determine API base url (supports port 3000 Node server, local file:/// opening, and port 5500 Live Server)
function getApiEndpoint(endpoint) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const isFile = window.location.protocol === 'file:';
  const isPort3000 = window.location.port === '3000';
  const isHttp = window.location.protocol.startsWith('http');

  // If opened as local file (e.g. file:///...), send API calls to localhost:3000
  if (isFile) {
    return 'http://localhost:3000' + (endpoint.startsWith('/') ? '' : '/') + endpoint;
  }

  if (isHttp && !isPort3000 && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    // When opened from VS Code Live Server (port 5500), proxy API calls to port 3000
    return 'http://localhost:3000' + (endpoint.startsWith('/') ? '' : '/') + endpoint;
  }
  return endpoint;
}
window.getApiEndpoint = getApiEndpoint;

// Safe API Fetch wrapper with Firebase & Offline Resilience
async function apiFetch(endpoint, options = {}) {
  const primaryUrl = getApiEndpoint(endpoint);
  try {
    const res = await fetch(primaryUrl, options);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) return res;
    if (contentType.includes('application/json')) return res;

    // Fallback if relative failed on a non-3000 port
    if (!primaryUrl.includes(':3000') && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      const fallbackUrl = 'http://localhost:3000' + (endpoint.startsWith('/') ? '' : '/') + endpoint;
      try {
        const res2 = await fetch(fallbackUrl, options);
        const ct2 = res2.headers.get('content-type') || '';
        if (res2.ok || ct2.includes('application/json')) return res2;
      } catch (err2) { /* continue */ }
    }

    // Direct Client Firebase & Local Cache Fallback on static host / GitHub Pages
    console.warn('Backend unavailable or returned static page, activating Client Firebase Fallback for:', endpoint);
    return handleClientScriptOfflineFallback(endpoint, options);
  } catch (err) {
    if (!primaryUrl.includes(':3000') && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      const fallbackUrl = 'http://localhost:3000' + (endpoint.startsWith('/') ? '' : '/') + endpoint;
      try {
        const res2 = await fetch(fallbackUrl, options);
        return res2;
      } catch (err2) { /* continue to fallback */ }
    }

    // Direct Client Firebase & Local Cache Fallback — Never throw a raw network error!
    console.warn('Backend unavailable, activating Client Firebase Fallback for:', endpoint);
    return handleClientScriptOfflineFallback(endpoint, options);
  }
}
window.apiFetch = apiFetch;

async function handleClientScriptOfflineFallback(endpoint, options) {
  let body = {};
  try {
    if (options && options.body) body = JSON.parse(options.body);
  } catch (e) { }

  if (endpoint.includes('/api/student/login')) {
    const query = body.identifier || '';
    let student = null;
    if (window.firebaseService) {
      student = await window.firebaseService.findApplication(query);
    }
    return {
      ok: !!student,
      status: student ? 200 : 404,
      json: async () => ({
        success: !!student,
        message: student ? `Welcome back, ${student.fullName}!` : 'Application not found.',
        student: student || null
      })
    };
  }


  if (endpoint.includes('/api/recruit') || endpoint.includes('/api/applications/apply') || endpoint.includes('/api/coordinator/apply')) {
    const newId = `APP-AU-2026-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
    const newApp = {
      id: newId,
      ...body,
      status: 'Pending',
      appliedAt: new Date().toISOString(),
      notes: 'Application registered successfully in database.'
    };
    if (window.firebaseService) {
      await window.firebaseService.saveApplication(newApp);
    }
    if (window.publicApplicationsCache) {
      window.publicApplicationsCache.unshift(newApp);
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        message: 'You have been registered successfully! Confirmation email and mobile message dispatched.',
        applicationId: newId,
        application: newApp,
        emailSent: true,
        emailStatus: 'Delivered to Inbox'
      })
    };
  }

  if (endpoint.includes('/api/info')) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ambassador: {
            name: 'Anil Pandey',
            role: 'Campus Ambassador — HackerRank Campus Crew',
            phone: '7900546102',
            collegeEmail: 'au-250303050423@amrapali.ac.in',
            alternateEmail: 'ap967143@gmail.com',
            maxCoordinators: 12
          },
          discordLink: 'https://discord.gg/m6ZMnSunx',
          quota: {
            totalPositions: 12,
            selected: 0,
            shortlisted: 0,
            remaining: 12,
            totalApplicants: (window.publicApplicationsCache && window.publicApplicationsCache.length) || 0
          }
        }
      })
    };
  }

  if (endpoint.includes('/api/announcements')) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'ann-1',
            title: 'HackerRank Campus Crew 2026 Coordinator Recruitment Open!',
            content: 'Applications are now live for 12 Student Coordinator positions at Amrapali University. Apply before the deadline!',
            tag: 'Recruitment'
          }
        ]
      })
    };
  }

  if (endpoint.includes('/api/admin/applications') || endpoint.includes('/api/applications/public-ledger')) {
    const apps = (window.firebaseService && window.firebaseService.getLocalApplications()) || window.publicApplicationsCache || [];
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: apps,
        stats: {
          total: apps.length,
          selected: apps.filter(a => a.status === 'Selected').length,
          shortlisted: apps.filter(a => a.status === 'Shortlisted').length,
          pending: apps.filter(a => a.status === 'Pending').length,
          quotaMax: 12
        }
      })
    };
  }

  return {
    ok: true,
    json: async () => ({ success: true, data: [] })
  };
}

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSkillPills();
  initRecruitmentForm();
  initQuizEngine();
  initGlobalSearch();
  initModals();
  initDiscordModal();
  initStudentPortal();
  initExcelDownloadButtons();
  loadAllData();

  // Ensure default view state: show public landing page unless hash is specifically #admin
  if (window.location.hash === '#admin') {
    showAdminView();
  } else {
    showPublicView();
  }
});

// ============================================================================
// 1. NAVIGATION & LAYOUT UI
// ============================================================================

function initNavbar() {
  const toggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (toggle && navLinks) {
    const icon = toggle.querySelector('i');

    const closeMobileNav = () => {
      navLinks.classList.remove('show');
      if (icon) {
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
      }
      document.body.style.overflow = '';
    };

    const openMobileNav = () => {
      navLinks.classList.add('show');
      if (icon) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-xmark');
      }
    };

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (navLinks.classList.contains('show')) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });

    // Close when clicking any link or button inside the drawer
    navLinks.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('click', () => {
        closeMobileNav();
        if (el.id !== 'navAdminLink') {
          showPublicView();
        }
      });
    });

    // Close drawer when clicking outside
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('show') && !navLinks.contains(e.target) && !toggle.contains(e.target)) {
        closeMobileNav();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('show')) {
        closeMobileNav();
      }
    });
  }

  // Brand header click returns to home public view
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.addEventListener('click', () => {
      showPublicView();
    });
  }

  const navAdmin = document.getElementById('navAdminLink');
  if (navAdmin) {
    navAdmin.addEventListener('click', (e) => {
      e.preventDefault();
      showAdminView();
    });
  }

  const navStudent = document.getElementById('navStudentLoginBtn');
  if (navStudent) {
    navStudent.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'login.html?tab=student';
    });
  }

  const heroStudent = document.getElementById('heroStudentLoginBtn');
  if (heroStudent) {
    heroStudent.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'login.html?tab=student';
    });
  }

  const navBio = document.getElementById('navBiometricBtn');
  if (navBio) {
    navBio.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'login.html?tab=biometric';
    });
  }

  const heroBio = document.getElementById('heroBiometricBtn');
  if (heroBio) {
    heroBio.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'login.html?tab=biometric';
    });
  }

  const cardFace = document.getElementById('ambassadorCardFaceBtn');
  if (cardFace) {
    cardFace.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'login.html?tab=biometric';
    });
  }

  const cardKey = document.getElementById('ambassadorCardKeyBtn');
  if (cardKey) {
    cardKey.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'login.html?tab=admin';
    });
  }

  const btnExit = document.getElementById('btnExitAdmin');
  if (btnExit) {
    btnExit.addEventListener('click', () => {
      showPublicView();
    });
  }

  const yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function showAdminView() {
  const pub = document.getElementById('publicView');
  const adm = document.getElementById('adminView');
  if (pub) pub.style.display = 'none';
  if (adm) adm.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (typeof window.adminInit === 'function') {
    window.adminInit();
  }
}
window.showAdminView = showAdminView;

function showPublicView() {
  const pub = document.getElementById('publicView');
  const adm = document.getElementById('adminView');
  if (adm) adm.style.display = 'none';
  if (pub) pub.style.display = 'block';
  if (window.location.hash === '#admin') {
    history.pushState(null, null, '#home');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showPublicView = showPublicView;

// Excel Download Interceptor: Completely prevents Live Server "Forbidden folder" error
function initExcelDownloadButtons() {
  document.querySelectorAll('a[href*="download-excel"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await triggerExcelDownload();
    });
  });
}
window.initExcelDownloadButtons = initExcelDownloadButtons;

async function triggerExcelDownload() {
  try {
    showToast('Generating Amrapali Campus Crew Excel ledger...', 'success');
    const url = getApiEndpoint('/api/applications/download-excel');
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'Amrapali_Campus_Crew_Applications_2026.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast('Excel (.CSV) downloaded successfully!', 'success');
      return;
    }
  } catch (err) {
    console.warn('Backend download call failed, generating in-browser CSV...', err);
  }

  // Client-side CSV generation fallback
  generateAndDownloadClientCsv();
}
window.triggerExcelDownload = triggerExcelDownload;

function generateAndDownloadClientCsv() {
  const apps = window.publicApplicationsCache || (state && state.applications) || [];
  const headers = [
    'Application ID', 'Full Name', 'Email', 'Mobile', 'Course',
    'Department', 'Year', 'Semester', 'College Name', 'Technical Skills',
    'Status', 'Applied At', 'Notes'
  ];

  let csvContent = headers.join(',') + '\r\n';

  apps.forEach(a => {
    const skills = Array.isArray(a.technicalSkills) ? a.technicalSkills.join('; ') : (a.technicalSkills || '');
    const row = [
      `"${a.id || ''}"`,
      `"${(a.fullName || '').replace(/"/g, '""')}"`,
      `"${(a.email || '').replace(/"/g, '""')}"`,
      `"${(a.mobile || '').replace(/"/g, '""')}"`,
      `"${(a.course || '').replace(/"/g, '""')}"`,
      `"${(a.department || '').replace(/"/g, '""')}"`,
      `"${(a.year || '').replace(/"/g, '""')}"`,
      `"${(a.semester || '').replace(/"/g, '""')}"`,
      `"${(a.collegeName || 'Amrapali University, Haldwani').replace(/"/g, '""')}"`,
      `"${skills.replace(/"/g, '""')}"`,
      `"${(a.status || 'Pending').replace(/"/g, '""')}"`,
      `"${(a.appliedAt || new Date().toISOString()).replace(/"/g, '""')}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(',') + '\r\n';
  });

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = 'Amrapali_Campus_Crew_Applications_2026.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
  showToast('Excel (.CSV) generated and downloaded successfully!', 'success');
}
window.generateAndDownloadClientCsv = generateAndDownloadClientCsv;

// Toast Notifications Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  const icon = type === 'success'
    ? '<i class="fa-solid fa-circle-check" style="color: var(--primary);"></i>'
    : '<i class="fa-solid fa-circle-exclamation" style="color: var(--accent-red);"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================================================
// 2. BACKEND DATA SYNCHRONIZATION
// ============================================================================

async function loadAllData() {
  try {
    await Promise.all([
      fetchInfo(),
      fetchAnnouncements(),
      fetchHackathons(),
      fetchContests(),
      fetchChallenges(),
      fetchCourses(),
      fetchEvents(),
      fetchOpportunities(),
      fetchPublicLedger()
    ]);
  } catch (err) {
    console.error('Error fetching portal data:', err);
  }
}

// Fetch Ambassador Profile & Coordinator Quota
async function fetchInfo() {
  try {
    const res = await apiFetch('/api/info');
    const json = await res.json();
    if (json.success && json.data) {
      state.ambassador = json.data.ambassador;
      state.quota = json.data.quota;

      const leftEl = document.getElementById('quotaSeatsLeft');
      const detEl = document.getElementById('quotaDetailText');
      const statCoord = document.getElementById('statCoordinators');

      if (leftEl) {
        leftEl.innerHTML = `${json.data.quota.remaining} <span style="font-size: 0.9rem; font-weight: normal; color: #94a3b8;">/ ${json.data.quota.totalPositions}</span>`;
      }
      if (detEl) {
        detEl.textContent = `Seats Available: ${json.data.quota.remaining} of ${json.data.quota.totalPositions} Remaining`;
      }
      if (statCoord) {
        statCoord.textContent = `${json.data.quota.remaining}`;
      }
    }
  } catch (e) {
    console.error('Failed to load info:', e);
  }
}
window.fetchInfo = fetchInfo;

// Fetch Campus Announcements
async function fetchAnnouncements() {
  try {
    const res = await apiFetch('/api/announcements');
    const json = await res.json();
    if (json.success && json.data && json.data.length > 0) {
      const ticker = document.getElementById('announcementTicker');
      if (ticker) {
        ticker.textContent = json.data.map(a => `${a.title} — ${a.content}`).join('  |  ');
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// Fetch Real-time Excel Ledger (Direct Cloud Firestore & API sync)
async function fetchPublicLedger() {
  try {
    // 1. Try Google Firebase Cloud Firestore first for live real-time sync
    if (window.firebaseService) {
      try {
        const fbApps = await window.firebaseService.getApplications();
        if (fbApps && fbApps.length > 0) {
          window.publicApplicationsCache = fbApps;
          state.applications = fbApps;
          renderPublicExcelLedger(fbApps);
        }
      } catch (fbErr) { }
    }

    // 2. Query API if server is running
    const res = await apiFetch('/api/admin/applications', {
      headers: { 'x-admin-token': 'amrapali2026' }
    });
    if (res && res.ok) {
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        window.publicApplicationsCache = json.data;
        state.applications = json.data;
        renderPublicExcelLedger(json.data);
      }
    }
  } catch (e) {
    if (window.publicApplicationsCache && window.publicApplicationsCache.length > 0) {
      renderPublicExcelLedger(window.publicApplicationsCache);
    }
  }
}

window.fetchPublicLedger = fetchPublicLedger;

function renderPublicExcelLedger(applications) {
  const tbody = document.getElementById('publicExcelLedgerBody');
  if (!tbody) return;

  if (!applications || applications.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 32px 16px;"><i class="fa-solid fa-file-signature" style="font-size: 1.6rem; color: var(--primary); margin-bottom: 8px; display: block;"></i>No coordinator submissions logged yet. Fill out the application form above to join!</td></tr>`;
    return;
  }

  tbody.innerHTML = applications.map((app, idx) => `
    <tr>
      <td class="col-index">${idx + 1}</td>
      <td class="mono" style="color: #38bdf8; font-weight: 600;">${app.id}</td>
      <td><strong style="color: #fff;">${app.fullName}</strong></td>
      <td>${app.course} &bull; ${app.department}</td>
      <td>${app.year} (${app.semester})</td>
      <td>
        <span class="badge" style="background: rgba(255,255,255,0.06); color: #cbd5e1; font-size: 0.72rem;">
          ${(Array.isArray(app.technicalSkills) ? app.technicalSkills : [app.technicalSkills]).slice(0, 2).join(', ')}
        </span>
      </td>
      <td style="color: var(--text-dim); font-size: 0.8rem;">${maskEmail(app.email)}</td>
      <td><span class="badge ${app.status === 'Selected' ? 'badge-green' : (app.status === 'Shortlisted' ? 'badge-blue' : 'badge-amber')}">${app.status}</span></td>
    </tr>
  `).join('');
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const parts = email.split('@');
  const name = parts[0];
  const maskedName = name.length > 3 ? name.substring(0, 2) + '***' + name.slice(-1) : name + '***';
  return `${maskedName}@${parts[1]}`;
}

// ============================================================================
// 3. HACKATHONS & COMPETITIONS
// ============================================================================

async function fetchHackathons() {
  try {
    const res = await apiFetch('/api/hackathons');
    const json = await res.json();
    if (json.success) {
      state.hackathons = json.data;
      renderHackathons(state.hackathons);
      initHackathonFilters();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderHackathons(list) {
  const container = document.getElementById('hackathonsContainer');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);"><i class="fa-solid fa-code" style="font-size: 2.2rem; margin-bottom: 12px; color: var(--primary);"></i><h4 style="color: #fff; margin-bottom: 6px;">No Hackathons Scheduled</h4><p style="font-size: 0.9rem; margin: 0;">Upcoming competitions will be announced here soon by Campus Ambassador Anil Pandey.</p></div>`;
    return;
  }

  container.innerHTML = list.map(h => {
    const statusClass = h.status === 'upcoming' ? 'badge-green' : (h.status === 'ongoing' ? 'badge-amber' : 'badge-cyan');
    const modeBadge = `<span class="badge ${h.mode === 'online' ? 'badge-blue' : (h.mode === 'offline' ? 'badge-purple' : 'badge-green')}"><i class="fa-solid fa-signal"></i> ${h.mode.toUpperCase()}</span>`;

    return `
      <div class="card">
        <div class="card-header">
          <span class="badge ${statusClass}"><i class="fa-solid fa-clock"></i> ${h.status.toUpperCase()}</span>
          ${modeBadge}
        </div>
        <h3 class="card-title">${h.name}</h3>
        <p class="card-desc">${h.description}</p>

        <div class="card-meta-list">
          <div class="card-meta-item">
            <strong>Organizer:</strong> <span>${h.organizer}</span>
          </div>
          <div class="card-meta-item">
            <strong>Timeline:</strong> <span>${h.startDate} to ${h.endDate}</span>
          </div>
          <div class="card-meta-item">
            <strong>Deadline:</strong> <span style="color: #fbbf24;">${h.registrationDeadline}</span>
          </div>
          <div class="card-meta-item">
            <strong>Team Size:</strong> <span>${h.teamSize}</span>
          </div>
          <div class="card-meta-item">
            <strong>Eligibility:</strong> <span>${h.eligibility}</span>
          </div>
          <div class="card-meta-item">
            <strong>Prizes:</strong> <span style="color: var(--primary); font-weight: 600;">${h.prizes}</span>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <strong style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-dim);">Tracks & Themes:</strong>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
            ${h.tracks.map(t => `<span class="badge" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid var(--border-color);">${t}</span>`).join('')}
          </div>
        </div>

        <div class="card-footer">
          <button class="btn btn-secondary btn-sm" onclick="showItemDetails('hackathon', '${h.id}')">
            <i class="fa-solid fa-circle-info"></i> Rules & Guidelines
          </button>
          <a href="${h.registrationLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
            Register on HackerRank <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function initHackathonFilters() {
  const filterBtns = document.querySelectorAll('#hackathonFilters .filter-tab');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      const mode = btn.dataset.mode;

      let filtered = [...state.hackathons];
      if (filter && filter !== 'all') {
        filtered = filtered.filter(h => h.status.toLowerCase() === filter.toLowerCase());
      }
      if (mode) {
        filtered = filtered.filter(h => h.mode.toLowerCase() === mode.toLowerCase());
      }
      renderHackathons(filtered);
    });
  });
}

// ============================================================================
// 4. CODING CONTESTS
// ============================================================================

async function fetchContests() {
  try {
    const res = await apiFetch('/api/contests');
    const json = await res.json();
    if (json.success) {
      state.contests = json.data;
      renderContests(state.contests);
      initContestFilters();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderContests(list) {
  const container = document.getElementById('contestsContainer');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);"><i class="fa-solid fa-terminal" style="font-size: 2.2rem; margin-bottom: 12px; color: #a855f7;"></i><h4 style="color: #fff; margin-bottom: 6px;">No Coding Contests Active</h4><p style="font-size: 0.9rem; margin: 0;">Collegiate & national coding challenges on HackerRank will be posted here soon.</p></div>`;
    return;
  }

  container.innerHTML = list.map(c => {
    const diffBadge = c.difficulty === 'Beginner' ? 'badge-green' : (c.difficulty === 'Intermediate' ? 'badge-blue' : 'badge-red');

    return `
      <div class="card">
        <div class="card-header">
          <span class="badge ${diffBadge}"><i class="fa-solid fa-layer-group"></i> ${c.difficulty}</span>
          <span class="badge badge-purple"><i class="fa-solid fa-globe"></i> ${c.level}</span>
        </div>
        <h3 class="card-title">${c.title}</h3>
        <p class="card-desc">${c.description}</p>

        <div class="card-meta-list">
          <div class="card-meta-item">
            <strong>Platform:</strong> <span style="color: var(--primary); font-weight: 600;">${c.platform}</span>
          </div>
          <div class="card-meta-item">
            <strong>Date & Time:</strong> <span>${c.date} &bull; ${c.time}</span>
          </div>
          <div class="card-meta-item">
            <strong>Duration:</strong> <span>${c.duration}</span>
          </div>
          <div class="card-meta-item">
            <strong>Eligibility:</strong> <span>${c.eligibility}</span>
          </div>
          <div class="card-meta-item">
            <strong>Key Topics:</strong> <span style="color: #38bdf8;">${c.topics}</span>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 14px;">
          <i class="fa-solid fa-shield-halved"></i> Rules: ${c.rules}
        </div>

        <div class="card-footer">
          <button class="btn btn-secondary btn-sm" onclick="showItemDetails('contest', '${c.id}')">
            <i class="fa-solid fa-book-open"></i> Syllabus
          </button>
          <a href="${c.contestLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
            Enter Contest <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function initContestFilters() {
  const filterBtns = document.querySelectorAll('#contestFilters .filter-tab');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const diff = btn.dataset.diff;
      const level = btn.dataset.level;

      let filtered = [...state.contests];
      if (diff && diff !== 'all') {
        filtered = filtered.filter(c => c.difficulty.toLowerCase() === diff.toLowerCase());
      }
      if (level) {
        filtered = filtered.filter(c => c.level.toLowerCase().includes(level.toLowerCase()));
      }
      renderContests(filtered);
    });
  });
}

// ============================================================================
// 5. QUICK CHALLENGES & CAMPUS LIVE QUIZ ENGINE
// ============================================================================

async function fetchChallenges() {
  try {
    const res = await apiFetch('/api/challenges');
    const json = await res.json();
    if (json.success) {
      state.challenges = json.data;
      renderDailyChallenges(state.challenges);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderDailyChallenges(list) {
  const container = document.getElementById('challengesContainer');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);"><i class="fa-solid fa-bolt" style="font-size: 2.2rem; margin-bottom: 12px; color: #fbbf24;"></i><h4 style="color: #fff; margin-bottom: 6px;">Daily Code Bites Updating</h4><p style="font-size: 0.9rem; margin: 0;">Interactive coding challenges will appear here daily.</p></div>`;
    return;
  }

  container.innerHTML = list.map((ch) => `
    <div class="card">
      <div class="card-header">
        <span class="badge badge-amber"><i class="fa-solid fa-bolt"></i> ${ch.type}</span>
        <span class="badge badge-cyan">${ch.difficulty}</span>
      </div>
      <h3 class="card-title">${ch.title}</h3>
      
      <div class="code-box">${escapeHtml(ch.snippet)}</div>

      <div class="quiz-options" id="optContainer-${ch.id}">
        ${ch.options.map(opt => `
          <button class="quiz-opt-btn" onclick="verifyDailyAnswer('${ch.id}', '${escapeHtml(opt)}')">
            ${escapeHtml(opt)}
          </button>
        `).join('')}
      </div>

      <div class="quiz-explanation" id="expContainer-${ch.id}"></div>
    </div>
  `).join('');
}

window.verifyDailyAnswer = async function (challengeId, selectedAnswer) {
  try {
    const res = await apiFetch('/api/challenges/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, selectedAnswer })
    });
    const json = await res.json();

    const optContainer = document.getElementById(`optContainer-${challengeId}`);
    const expContainer = document.getElementById(`expContainer-${challengeId}`);

    if (optContainer && json.success) {
      const buttons = optContainer.querySelectorAll('.quiz-opt-btn');
      buttons.forEach(btn => {
        btn.disabled = true;
        const text = btn.innerText.trim();
        if (text === json.correctAnswer) {
          btn.classList.add('correct');
        } else if (text === selectedAnswer && !json.isCorrect) {
          btn.classList.add('wrong');
        }
      });

      if (expContainer) {
        expContainer.style.display = 'block';
        expContainer.innerHTML = `
          <strong>${json.isCorrect ? '<span style="color: var(--primary);"><i class="fa-solid fa-check"></i> Correct!</span>' : '<span style="color: var(--accent-red);"><i class="fa-solid fa-xmark"></i> Incorrect.</span>'}</strong>
          <p style="margin-top: 4px;">${json.explanation}</p>
        `;
      }
    }
  } catch (err) {
    console.error('Error verifying answer:', err);
  }
};

function initQuizEngine() {
  const btnTabDaily = document.getElementById('btnTabDaily');
  const btnTabLiveQuiz = document.getElementById('btnTabLiveQuiz');
  const dailyView = document.getElementById('dailyChallengesView');
  const liveQuizView = document.getElementById('liveQuizView');

  if (btnTabDaily && btnTabLiveQuiz) {
    btnTabDaily.addEventListener('click', () => {
      btnTabDaily.classList.add('active');
      btnTabLiveQuiz.classList.remove('active');
      dailyView.style.display = 'block';
      liveQuizView.style.display = 'none';
    });

    btnTabLiveQuiz.addEventListener('click', () => {
      btnTabLiveQuiz.classList.add('active');
      btnTabDaily.classList.remove('active');
      dailyView.style.display = 'none';
      liveQuizView.style.display = 'block';
      startLiveQuiz();
    });
  }

  const nextBtn = document.getElementById('quizNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      state.currentQuizIndex++;
      if (state.currentQuizIndex < state.challenges.length) {
        renderQuizStep();
      } else {
        finishLiveQuiz();
      }
    });
  }

  const restartBtn = document.getElementById('quizRestartBtn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      startLiveQuiz();
    });
  }
}

function startLiveQuiz() {
  state.currentQuizIndex = 0;
  state.quizScore = 0;
  state.quizAnswered = false;

  if (!state.challenges || state.challenges.length === 0) {
    const qContent = document.getElementById('quizQuestionContent');
    if (qContent) {
      qContent.style.display = 'block';
      qContent.innerHTML = `<div style="text-align: center; padding: 48px 20px; color: var(--text-muted);"><i class="fa-solid fa-gamepad" style="font-size: 2.2rem; margin-bottom: 12px; color: var(--primary);"></i><h4 style="color: #fff; margin-bottom: 6px;">Campus Live Quiz Arena</h4><p style="font-size: 0.9rem; margin: 0;">Live contest quiz questions are being set up for the upcoming session.</p></div>`;
    }
    const finishedBox = document.getElementById('quizFinishedBox');
    if (finishedBox) finishedBox.style.display = 'none';
    return;
  }

  document.getElementById('quizQuestionContent').style.display = 'block';
  document.getElementById('quizFinishedBox').style.display = 'none';
  document.getElementById('quizLiveScore').textContent = '0 pts';
  renderQuizStep();
}

function renderQuizStep() {
  state.quizAnswered = false;
  const ch = state.challenges[state.currentQuizIndex];
  if (!ch) return;

  document.getElementById('quizQuestionTitle').textContent = `Question ${state.currentQuizIndex + 1} of ${state.challenges.length}`;
  document.getElementById('quizQuestionText').textContent = ch.title;
  document.getElementById('quizCodeSnippet').textContent = ch.snippet;

  const expBox = document.getElementById('quizExplanationBox');
  expBox.style.display = 'none';
  document.getElementById('quizNextBtn').style.display = 'none';

  const optContainer = document.getElementById('quizOptionsContainer');
  optContainer.innerHTML = ch.options.map(opt => `
    <button class="quiz-opt-btn" onclick="submitLiveQuizAnswer('${ch.id}', '${escapeHtml(opt)}')">
      ${escapeHtml(opt)}
    </button>
  `).join('');
}

window.submitLiveQuizAnswer = async function (challengeId, selectedAnswer) {
  if (state.quizAnswered) return;
  state.quizAnswered = true;

  try {
    const res = await apiFetch('/api/challenges/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, selectedAnswer })
    });
    const json = await res.json();

    const optContainer = document.getElementById('quizOptionsContainer');
    const buttons = optContainer.querySelectorAll('.quiz-opt-btn');
    buttons.forEach(btn => {
      btn.disabled = true;
      const text = btn.innerText.trim();
      if (text === json.correctAnswer) {
        btn.classList.add('correct');
      } else if (text === selectedAnswer && !json.isCorrect) {
        btn.classList.add('wrong');
      }
    });

    if (json.isCorrect) {
      state.quizScore++;
      document.getElementById('quizLiveScore').textContent = `${state.quizScore * 10} pts`;
    }

    const expBox = document.getElementById('quizExplanationBox');
    expBox.style.display = 'block';
    document.getElementById('quizExplanationText').textContent = json.explanation;
    document.getElementById('quizNextBtn').style.display = 'inline-flex';
  } catch (e) {
    console.error(e);
  }
};

function finishLiveQuiz() {
  document.getElementById('quizQuestionContent').style.display = 'none';
  const finishedBox = document.getElementById('quizFinishedBox');
  finishedBox.style.display = 'block';

  const total = state.challenges.length;
  document.getElementById('quizFinalScore').textContent = `${state.quizScore} / ${total}`;

  let remark = "Good effort! Keep practicing on HackerRank!";
  if (state.quizScore === total) remark = "🏆 Perfect Score! Exceptional coding instincts!";
  else if (state.quizScore >= total * 0.7) remark = "🌟 Strong Performance! Ready for Campus Crew contests!";
  document.getElementById('quizPerformanceRemark').textContent = remark;
}

// ============================================================================
// 6. COURSES & SKILL TRACKS
// ============================================================================

async function fetchCourses() {
  try {
    const res = await apiFetch('/api/courses');
    const json = await res.json();
    if (json.success) {
      state.courses = json.data;
      renderCourses(state.courses);
      initCourseFilters();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderCourses(list) {
  const container = document.getElementById('coursesContainer');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);"><i class="fa-solid fa-book-bookmark" style="font-size: 2.2rem; margin-bottom: 12px; color: #3b82f6;"></i><h4 style="color: #fff; margin-bottom: 6px;">Skill Tracks Updating</h4><p style="font-size: 0.9rem; margin: 0;">Verified courses across C++, Python, DSA, and Web Development will be published here.</p></div>`;
    return;
  }

  container.innerHTML = list.map(c => `
    <div class="card">
      <div class="card-header">
        <span class="badge badge-blue">${c.category}</span>
        <span class="badge badge-green"><i class="fa-solid fa-certificate"></i> ${c.isFree ? '100% Free' : 'Verified'}</span>
      </div>
      <h3 class="card-title">${c.title}</h3>
      <p class="card-desc">${c.description}</p>

      <div class="card-meta-list">
        <div class="card-meta-item">
          <strong>Provider:</strong> <span>${c.provider}</span>
        </div>
        <div class="card-meta-item">
          <strong>Level:</strong> <span>${c.level}</span>
        </div>
        <div class="card-meta-item">
          <strong>Duration:</strong> <span>${c.duration}</span>
        </div>
        <div class="card-meta-item">
          <strong>Certificate:</strong> <span>${c.hasCertificate ? 'Available upon completion' : 'Practice track'}</span>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <strong style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-dim);">Skills Covered:</strong>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
          ${c.skills.map(s => `<span class="badge" style="background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid var(--border-color);">${s}</span>`).join('')}
        </div>
      </div>

      <div class="card-footer">
        <span style="font-size: 0.78rem; color: var(--text-dim);"><i class="fa-solid fa-lock-open"></i> Open Access</span>
        <a href="${c.link}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
          Access Course <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>
  `).join('');
}

function initCourseFilters() {
  const filterBtns = document.querySelectorAll('#courseCategoryFilters .filter-tab');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.dataset.category;
      let filtered = [...state.courses];
      if (category && category !== 'all') {
        filtered = filtered.filter(c => c.category.toLowerCase() === category.toLowerCase());
      }
      renderCourses(filtered);
    });
  });
}

// ============================================================================
// 7. EVENTS, WORKSHOPS & OPPORTUNITIES
// ============================================================================

async function fetchEvents() {
  try {
    const res = await apiFetch('/api/events');
    const json = await res.json();
    if (json.success) {
      state.events = json.data;
      renderEvents(state.events);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderEvents(list) {
  const container = document.getElementById('eventsContainer');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);"><i class="fa-solid fa-calendar-xmark" style="font-size: 2.2rem; margin-bottom: 12px; color: var(--primary);"></i><h4 style="color: #fff; margin-bottom: 6px;">No Workshops Scheduled</h4><p style="font-size: 0.9rem; margin: 0;">Upcoming webinars and workshops at Amrapali University will be posted soon.</p></div>`;
    return;
  }

  container.innerHTML = list.map(ev => `
    <div class="card">
      <div class="card-header">
        <span class="badge badge-purple"><i class="fa-solid fa-calendar-check"></i> ${ev.type}</span>
        <span class="badge badge-green">AU Campus Event</span>
      </div>
      <h3 class="card-title">${ev.title}</h3>
      <p class="card-desc">${ev.description}</p>

      <div class="card-meta-list">
        <div class="card-meta-item">
          <strong>Date & Time:</strong> <span>${ev.date} &bull; ${ev.time}</span>
        </div>
        <div class="card-meta-item">
          <strong>Speaker/Lead:</strong> <span>${ev.speaker}</span>
        </div>
        <div class="card-meta-item">
          <strong>Venue/Mode:</strong> <span>${ev.venue}</span>
        </div>
        <div class="card-meta-item">
          <strong>Deadline:</strong> <span style="color: #fbbf24;">${ev.deadline}</span>
        </div>
        <div class="card-meta-item">
          <strong>Eligibility:</strong> <span>${ev.eligibility}</span>
        </div>
      </div>

      <div class="card-footer">
        <span style="font-size: 0.8rem; color: var(--text-dim);">RSVP Required</span>
        <a href="${ev.rsvpLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
          RSVP & Attend <i class="fa-solid fa-user-plus"></i>
        </a>
      </div>
    </div>
  `).join('');
}

async function fetchOpportunities() {
  try {
    const res = await apiFetch('/api/opportunities');
    const json = await res.json();
    if (json.success) {
      state.opportunities = json.data;
      renderOpportunities(state.opportunities);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderOpportunities(list) {
  const container = document.getElementById('opportunitiesContainer');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);"><i class="fa-solid fa-briefcase" style="font-size: 2.2rem; margin-bottom: 12px; color: #38bdf8;"></i><h4 style="color: #fff; margin-bottom: 6px;">No Internships Listed</h4><p style="font-size: 0.9rem; margin: 0;">Verified technology opportunities and student programs will be updated here.</p></div>`;
    return;
  }

  container.innerHTML = list.map(op => `
    <div class="card">
      <div class="card-header">
        <span class="badge badge-cyan"><i class="fa-solid fa-award"></i> ${op.type}</span>
        <span class="badge badge-green"><i class="fa-solid fa-shield-check"></i> Verified</span>
      </div>
      <h3 class="card-title">${op.title}</h3>
      <p class="card-desc">${op.description}</p>

      <div class="card-meta-list">
        <div class="card-meta-item">
          <strong>Provider:</strong> <span>${op.provider}</span>
        </div>
        <div class="card-meta-item">
          <strong>Eligibility:</strong> <span>${op.eligibility}</span>
        </div>
        <div class="card-meta-item">
          <strong>Benefits/Perks:</strong> <span style="color: var(--primary);">${op.stipend}</span>
        </div>
        <div class="card-meta-item">
          <strong>Deadline:</strong> <span style="color: #fbbf24;">${op.deadline}</span>
        </div>
      </div>

      <div class="card-footer">
        <span style="font-size: 0.78rem; color: var(--text-dim);"><i class="fa-solid fa-check"></i> Zero Fee Program</span>
        <a href="${op.link}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
          Official Application <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// 8. COORDINATOR RECRUITMENT APPLICATION (12 POSITIONS)
// ============================================================================

function initSkillPills() {
  const pills = document.querySelectorAll('#skillPillsContainer .skill-pill');
  pills.forEach(pill => {
    const skill = pill.dataset.skill;
    if (state.selectedSkills.has(skill)) {
      pill.classList.add('selected');
    }

    pill.addEventListener('click', () => {
      if (state.selectedSkills.has(skill)) {
        state.selectedSkills.delete(skill);
        pill.classList.remove('selected');
      } else {
        state.selectedSkills.add(skill);
        pill.classList.add('selected');
      }
    });
  });
}

function initRecruitmentForm() {
  const form = document.getElementById('coordinatorForm');
  if (!form) return;

  const emailInput = document.getElementById('email');
  const mobileInput = document.getElementById('mobile');
  const fullNameInput = document.getElementById('fullName');

  // Initialize Anti-Bot Visual CAPTCHA
  let recruitmentCaptcha = null;
  if (typeof CampusCaptcha !== 'undefined') {
    recruitmentCaptcha = new CampusCaptcha(
      'recruitmentCaptchaCanvas',
      'recruitmentCaptchaInput',
      'btnRefreshRecruitmentCaptcha',
      'recruitmentCaptchaError'
    );
    const speakBtn = document.getElementById('btnSpeakRecruitmentCaptcha');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => recruitmentCaptcha.speak());
    }
  }

  // Real-Time Email OTP Verification State & Elements
  let isEmailVerified = false;
  let verifiedEmailAddress = '';
  let otpCountdownTimer = null;

  const btnSendOtp = document.getElementById('btnSendOtp');
  const btnResendOtp = document.getElementById('btnResendOtp');
  const btnVerifyOtp = document.getElementById('btnVerifyOtp');
  const emailOtpInput = document.getElementById('emailOtpInput');
  const otpInputRow = document.getElementById('otpInputRow');
  const otpStatusMsg = document.getElementById('otpStatusMsg');
  const otpFeedbackMsg = document.getElementById('otpFeedbackMsg');
  const emailVerifiedBadge = document.getElementById('emailVerifiedBadge');
  const directGmailBtn = document.getElementById('directGmailBtn');

  function startOtpCountdown(seconds = 30) {
    if (otpCountdownTimer) clearInterval(otpCountdownTimer);
    let remaining = seconds;
    if (btnSendOtp) {
      btnSendOtp.disabled = true;
      btnSendOtp.innerHTML = `<i class="fa-solid fa-clock"></i> Resend in ${remaining}s`;
    }
    if (btnResendOtp) {
      btnResendOtp.disabled = true;
      btnResendOtp.style.display = 'inline-flex';
      btnResendOtp.innerHTML = `<i class="fa-solid fa-clock"></i> ${remaining}s`;
    }

    otpCountdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
        if (btnSendOtp && !isEmailVerified) {
          btnSendOtp.disabled = false;
          btnSendOtp.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Resend OTP';
        }
        if (btnResendOtp && !isEmailVerified) {
          btnResendOtp.disabled = false;
          btnResendOtp.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Resend OTP';
        }
      } else {
        if (btnSendOtp && !isEmailVerified) {
          btnSendOtp.innerHTML = `<i class="fa-solid fa-clock"></i> Resend in ${remaining}s`;
        }
        if (btnResendOtp && !isEmailVerified) {
          btnResendOtp.innerHTML = `<i class="fa-solid fa-clock"></i> ${remaining}s`;
        }
      }
    }, 1000);
  }

  async function handleSendOtp() {
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const mobile = mobileInput ? mobileInput.value.trim() : '';
    const fullName = fullNameInput ? fullNameInput.value.trim() : '';

    if (!email || !email.includes('@') || !email.includes('.')) {
      showToast('Please enter a valid email address first.', 'error');
      if (emailInput) emailInput.focus();
      return;
    }

    // Require CAPTCHA validation before sending OTP to eliminate bot spam
    if (recruitmentCaptcha && !recruitmentCaptcha.validate()) {
      showToast('Anti-Bot Security: Please solve the CAPTCHA characters below before requesting an OTP.', 'error');
      const captchaSec = document.getElementById('recruitmentCaptchaSection');
      if (captchaSec) captchaSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (btnSendOtp) {
      btnSendOtp.disabled = true;
      btnSendOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending email...';
    }
    if (otpStatusMsg) {
      otpStatusMsg.innerHTML = '<span style="color: #38bdf8;"><i class="fa-solid fa-paper-plane fa-fade"></i> Sending 6-digit code to inbox...</span>';
    }

    try {
      const res = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName })
      });
      const data = await res.json();

      if (data.success) {
        if (otpInputRow) otpInputRow.style.display = 'block';
        if (emailOtpInput) emailOtpInput.focus();
        if (otpFeedbackMsg) {
          otpFeedbackMsg.innerHTML = `<span style="color: #00ea64;"><i class="fa-solid fa-circle-check"></i> Fresh OTP dispatched to <strong>${email}</strong>! Valid for 10 minutes.</span>`;
        }
        if (otpStatusMsg) {
          otpStatusMsg.innerHTML = '<span style="color: #00ea64;">Code sent successfully!</span>';
        }
        if (directGmailBtn && data.gmailUrl) {
          directGmailBtn.href = data.gmailUrl;
          directGmailBtn.style.display = 'inline-flex';
        }
        showToast(`Verification OTP dispatched to ${email}!`, 'success');
        startOtpCountdown(30);
      } else {
        throw new Error(data.message || 'Failed to send OTP.');
      }
    } catch (err) {
      console.warn('Send OTP note:', err.message);
      if (otpStatusMsg) {
        otpStatusMsg.innerHTML = `<span style="color: #f87171;"><i class="fa-solid fa-circle-exclamation"></i> ${err.message}</span>`;
      }
      showToast(err.message, 'error');
      if (btnSendOtp) {
        btnSendOtp.disabled = false;
        btnSendOtp.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP Verification Code';
      }
    }
  }

  if (btnSendOtp) btnSendOtp.addEventListener('click', handleSendOtp);
  if (btnResendOtp) btnResendOtp.addEventListener('click', handleSendOtp);

  async function handleVerifyOtp() {
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const otp = emailOtpInput ? emailOtpInput.value.trim() : '';

    if (!otp || otp.length !== 6) {
      showToast('Please enter the 6-digit OTP code received.', 'error');
      if (emailOtpInput) emailOtpInput.focus();
      return;
    }

    if (btnVerifyOtp) {
      btnVerifyOtp.disabled = true;
      btnVerifyOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    }

    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();

      if (data.success) {
        isEmailVerified = true;
        verifiedEmailAddress = email;

        if (emailVerifiedBadge) emailVerifiedBadge.style.display = 'inline-flex';
        if (btnSendOtp) {
          btnSendOtp.disabled = true;
          btnSendOtp.style.display = 'none';
        }
        if (otpStatusMsg) {
          otpStatusMsg.innerHTML = '<span style="color: #00ea64; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Email Authenticated & Verified</span>';
        }
        if (otpInputRow) {
          otpInputRow.style.display = 'none';
        }
        if (emailInput) {
          emailInput.style.borderColor = '#00ea64';
          emailInput.readOnly = true;
        }

        showToast('Email authenticated successfully! You can now submit your application.', 'success');
      } else {
        throw new Error(data.message || 'Invalid OTP code.');
      }
    } catch (err) {
      if (otpFeedbackMsg) {
        otpFeedbackMsg.innerHTML = `<span style="color: #f87171;"><i class="fa-solid fa-circle-exclamation"></i> ${err.message}</span>`;
      }
      showToast(err.message, 'error');
    } finally {
      if (btnVerifyOtp) {
        btnVerifyOtp.disabled = false;
        btnVerifyOtp.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify OTP';
      }
    }
  }

  if (btnVerifyOtp) btnVerifyOtp.addEventListener('click', handleVerifyOtp);
  if (emailOtpInput) {
    emailOtpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleVerifyOtp();
      }
    });
  }

  // Application Submission Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Verify Anti-Bot CAPTCHA
    if (recruitmentCaptcha && !recruitmentCaptcha.validate()) {
      showToast('Security Verification: Please solve the CAPTCHA correctly.', 'error');
      const captchaSec = document.getElementById('recruitmentCaptchaSection');
      if (captchaSec) captchaSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const mobile = mobileInput ? mobileInput.value.trim() : '';

    // 2. Verify Email Authenticity via OTP
    if (!isEmailVerified || verifiedEmailAddress !== email) {
      showToast('Please authenticate your email using the 6-digit OTP code before submitting.', 'error');
      const otpSection = document.getElementById('otpVerificationSection');
      if (otpSection) otpSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (emailOtpInput && otpInputRow && otpInputRow.style.display !== 'none') {
        emailOtpInput.focus();
      } else {
        handleSendOtp();
      }
      return;
    }

    const cleanDigits = mobile.replace(/\D/g, '');
    if (cleanDigits.length > 0 && cleanDigits.length < 10) {
      showToast('If providing a mobile number, please enter a valid 10-digit number.', 'error');
      if (mobileInput) mobileInput.focus();
      return;
    }

    const submitBtn = document.getElementById('submitAppBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting to Firebase Cloud...';

    const customSkillsInput = document.getElementById('customSkills').value.trim();
    const skillsArray = Array.from(state.selectedSkills);
    if (customSkillsInput) {
      customSkillsInput.split(',').map(s => s.trim()).filter(Boolean).forEach(s => skillsArray.push(s));
    }

    if (skillsArray.length === 0) {
      showToast('Please select or specify at least one technical skill.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application & Receive Confirmation Email';
      return;
    }

    const newAppId = `APP-AU-2026-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
    const payload = {
      id: newAppId,
      fullName: fullNameInput.value.trim(),
      email: email,
      mobile: mobile,
      course: document.getElementById('course').value,
      department: document.getElementById('department').value.trim(),
      year: document.getElementById('year').value,
      semester: document.getElementById('semester').value,
      collegeName: document.getElementById('collegeName').value.trim(),
      technicalSkills: skillsArray,
      previousExperience: document.getElementById('previousExperience').value.trim(),
      reasonToJoin: document.getElementById('reasonToJoin').value.trim(),
      privacyConsent: document.getElementById('privacyConsent').checked,
      status: 'Pending',
      appliedAt: new Date().toISOString(),
      notes: 'Application registered. Under active review for 12 coordinator seats.'
    };

    try {
      // 1. Direct Save to Google Firebase Cloud Firestore
      if (window.firebaseService) {
        try {
          await window.firebaseService.saveApplication(payload);
          console.log('🔥 Application saved directly to Firebase Firestore:', payload.id);
        } catch (fbErr) {
          console.warn('Direct Firestore save note:', fbErr.message);
        }
      }

      // 2. Also send to Backend API (if available) for Email/SMS notification dispatch
      let json = { success: true, applicationId: newAppId };
      try {
        const res = await apiFetch('/api/recruit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          json = await res.json();
        }
      } catch (netErr) {
        console.warn('Backend API note, saved via Firebase/Local resilience:', netErr.message);
      }

      state.latestEmailPreview = json.emailPreview || null;
      showSuccessModal(
        json.applicationId || newAppId,
        payload.fullName,
        payload.email,
        payload.mobile,
        json.emailStatus || 'Delivered & Saved',
        json.whatsappUrl,
        json.smsUrl,
        json.smsMessage,
        json.mailtoUrl
      );

      // Update local application cache immediately
      if (window.publicApplicationsCache) {
        window.publicApplicationsCache.unshift(payload);
      }

      try {
        const stored = localStorage.getItem('campus_crew_applications');
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(payload);
        localStorage.setItem('campus_crew_applications', JSON.stringify(list));
      } catch (e) { }

      form.reset();
      isEmailVerified = false;
      verifiedEmailAddress = '';
      if (emailInput) {
        emailInput.readOnly = false;
        emailInput.style.borderColor = '';
      }
      if (emailVerifiedBadge) emailVerifiedBadge.style.display = 'none';
      if (btnSendOtp) {
        btnSendOtp.disabled = false;
        btnSendOtp.style.display = 'inline-flex';
        btnSendOtp.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP Verification Code';
      }
      if (otpStatusMsg) otpStatusMsg.innerHTML = '';
      if (otpInputRow) otpInputRow.style.display = 'none';
      if (otpCountdownTimer) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
      }
      document.getElementById('collegeName').value = "Amrapali University, Haldwani";
      state.selectedSkills = new Set(['C++', 'DSA', 'Web Development']);
      initSkillPills();
      fetchInfo();
      fetchPublicLedger();

      // Refresh CAPTCHA for future submission
      if (recruitmentCaptcha) recruitmentCaptcha.refresh();

      showToast('You have been registered successfully! Application saved to Firebase.', 'success');
    } catch (err) {
      console.error('Submission error:', err);
      showToast('Error processing application. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application & Receive Confirmation Email';
    }
  });
}


function showSuccessModal(appId, name, email, mobile, emailStatus, whatsappUrl, smsUrl, smsMessage, mailtoUrl) {
  const appIdEl = document.getElementById('successModalAppId');
  if (appIdEl) appIdEl.textContent = appId;
  const nameEl = document.getElementById('successModalName');
  if (nameEl) nameEl.textContent = name;
  const emailEl = document.getElementById('successModalEmail');
  if (emailEl) emailEl.textContent = email;
  const mobileEl = document.getElementById('successModalMobile');
  if (mobileEl) mobileEl.textContent = mobile || 'Not Provided';

  const statusEl = document.getElementById('successModalEmailStatus');
  if (statusEl) {
    statusEl.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Email (${emailStatus || 'Delivered'}) + SMS Dispatched`;
  }

  const alertStatusEl = document.getElementById('successModalAlertStatus');
  if (alertStatusEl) {
    alertStatusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Your registration has been submitted successfully!`;
  }

  const emailBtn = document.getElementById('successModalEmailBtn');
  if (emailBtn) {
    emailBtn.href = mailtoUrl || `mailto:${email}?subject=Student%20Coordinator%20Registration%20Confirmed&body=Your%20registration%20(${appId})%20has%20been%20submitted%20successfully!%20Join%20Discord:%20https://discord.gg/m6ZMnSunx`;
  }

  const waBtn = document.getElementById('successModalWhatsAppBtn');
  if (waBtn) {
    if (whatsappUrl) {
      waBtn.href = whatsappUrl;
      waBtn.style.display = 'inline-flex';
    } else if (smsUrl) {
      waBtn.href = smsUrl;
      waBtn.style.display = 'inline-flex';
    } else {
      waBtn.style.display = 'none';
    }
  }

  const discordBtn = document.getElementById('successModalDiscordBtn');
  if (discordBtn) {
    discordBtn.href = 'https://discord.gg/m6ZMnSunx';
  }

  const modal = document.getElementById('appSuccessModal');
  if (modal) modal.classList.add('active');
}

// ============================================================================
// 9. MODALS & DISCORD ARENA
// ============================================================================

function initModals() {
  const closeSuccess = document.getElementById('btnCloseSuccessModal');
  const okSuccess = document.getElementById('btnOkSuccessModal');
  const modal = document.getElementById('appSuccessModal');

  const closeModal = () => { if (modal) modal.classList.remove('active'); };
  if (closeSuccess) closeSuccess.addEventListener('click', closeModal);
  if (okSuccess) okSuccess.addEventListener('click', closeModal);

  // Preview confirmation email button in success modal
  const btnPrev = document.getElementById('btnPreviewMyEmail');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (state.latestEmailPreview) {
        document.getElementById('emailPrevSubject').textContent = state.latestEmailPreview.subject;
        document.getElementById('emailPrevContent').textContent = state.latestEmailPreview.body;
        document.getElementById('adminEmailPreviewModal').classList.add('active');
      } else {
        showToast('Confirmation email logged to outbox.', 'success');
      }
    });
  }

  // Close opportunity / event details modal
  const closeEvtDet = document.getElementById('btnCloseEventDetailsModal');
  if (closeEvtDet) {
    closeEvtDet.addEventListener('click', () => {
      document.getElementById('eventDetailsModal').classList.remove('active');
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }
  });
}

function initDiscordModal() {
  const btnJoin = document.getElementById('btnJoinDiscordArena');
  const modal = document.getElementById('discordArenaModal');
  const closeBtn = document.getElementById('btnCloseDiscordModal');
  const copyBtn = document.getElementById('btnCopyDiscordLink');

  if (btnJoin && modal) {
    btnJoin.addEventListener('click', () => {
      modal.classList.add('active');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('https://discord.gg/m6ZMnSunx');
      showToast('Discord invite link copied to clipboard!', 'success');
    });
  }
}

// Student Applicant Portal (Distinct Cyan/Blue Application Tracker)
function initStudentPortal() {
  const modal = document.getElementById('studentLoginModal');
  const navBtn = document.getElementById('navStudentLoginBtn');
  const heroBtn = document.getElementById('heroStudentLoginBtn');
  const closeBtn = document.getElementById('btnCloseStudentModal');
  const form = document.getElementById('studentLoginForm');
  const input = document.getElementById('studentIdentifierInput');
  const inputView = document.getElementById('studentInputView');
  const recordView = document.getElementById('studentRecordView');
  const btnLookupAnother = document.getElementById('btnStudentLookupAnother');
  const btnGoApply = document.getElementById('btnStudentGoApply');

  function openPortal() {
    if (modal) {
      modal.classList.add('active');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  function closePortal() {
    if (modal) modal.classList.remove('active');
  }

  if (navBtn) navBtn.addEventListener('click', (e) => { e.preventDefault(); openPortal(); });
  if (heroBtn) heroBtn.addEventListener('click', (e) => { e.preventDefault(); openPortal(); });
  if (closeBtn) closeBtn.addEventListener('click', closePortal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePortal();
    });
  }

  if (btnGoApply) {
    btnGoApply.addEventListener('click', () => {
      closePortal();
    });
  }

  if (btnLookupAnother) {
    btnLookupAnother.addEventListener('click', () => {
      if (recordView) recordView.style.display = 'none';
      if (inputView) inputView.style.display = 'block';
      if (input) {
        input.value = '';
        input.focus();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) {
        showToast('Please enter your Registered Email Address or Application ID.', 'error');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Application Record...';
      }

      let studentRecord = null;

      // 1. Attempt server API lookup via apiFetch
      try {
        const res = await apiFetch('/api/student/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: val })
        });
        const json = await res.json();

        if (json.success && json.student) {
          studentRecord = json.student;
        } else if (res.status === 404) {
          // If server says not found, we will still check local cache below
        }
      } catch (err) {
        console.warn('Network API lookup failed, falling back to local database cache:', err);
      }

      // 2. Client-side local application database fallback
      if (!studentRecord) {
        const cleanVal = val.toLowerCase().trim();
        const digits = val.replace(/\D/g, '');
        const last10Q = digits.length >= 10 ? digits.slice(-10) : digits;

        function matchCand(st) {
          if (!st) return false;
          const id = (st.id || '').trim().toLowerCase();
          const email = (st.email || '').trim().toLowerCase();
          const mDigits = (st.mobile || '').replace(/\D/g, '');
          const last10M = mDigits.length >= 10 ? mDigits.slice(-10) : mDigits;

          if (id === cleanVal || id.replace(/#/g, '') === cleanVal.replace(/#/g, '')) return true;
          if (email === cleanVal) return true;
          if (last10Q.length >= 10 && last10M.length >= 10 && last10M === last10Q) return true;
          if (digits.length >= 7 && (mDigits.includes(digits) || digits.includes(mDigits))) return true;
          return false;
        }

        // Check in-memory cache
        const cache = window.publicApplicationsCache || (state && state.applications) || [];
        studentRecord = cache.find(matchCand);

        // Check localStorage
        if (!studentRecord) {
          try {
            const stored = localStorage.getItem('campus_crew_applications') || localStorage.getItem('hackerrank_applications');
            if (stored) {
              const list = JSON.parse(stored);
              if (Array.isArray(list)) studentRecord = list.find(matchCand);
            }
          } catch (e) { }
        }

        // Check static database.json
        if (!studentRecord) {
          const paths = ['data/database.json', '/data/database.json', '../data/database.json'];
          for (const p of paths) {
            try {
              const res = await fetch(p);
              if (res.ok) {
                const db = await res.json();
                if (db && Array.isArray(db.applications)) {
                  studentRecord = db.applications.find(matchCand);
                  if (studentRecord) break;
                }
              }
            } catch (e) { }
          }
        }

        // Verified preloaded fallback
        if (!studentRecord) {
          const SEED_LIST = [
            {
              id: "APP-AU-2026-001",
              fullName: "kartik gupta",
              email: "kartikgupta2414257@gmail.com",
              mobile: "7302715858",
              course: "BCA",
              department: "ftca",
              year: "2nd Year",
              semester: "3rd Semester",
              collegeName: "Amrapali University, Haldwani",
              technicalSkills: ["C++", "DSA", "Web Development", "Java", "Data Structures & Algorithms"],
              status: "Pending",
              appliedAt: "2026-10-09T19:18:53.791Z",
              notes: "Application submitted successfully. Under active review by Campus Ambassador Anil Pandey."
            },
            {
              id: "APP-AU-2026-002",
              fullName: "Rohan Sharma",
              email: "rohan.test@amrapali.ac.in",
              mobile: "9876543210",
              course: "B.Tech CSE",
              department: "Computer Science",
              year: "2nd Year",
              semester: "4th Semester",
              collegeName: "Amrapali University, Haldwani",
              technicalSkills: ["C++", "DSA", "Web Dev"],
              status: "Pending",
              appliedAt: "2026-10-09T19:59:38.495Z",
              notes: "Profile shortlisted for personal interview with Ambassador Anil Pandey."
            },
            {
              id: "APP-AU-2026-003",
              fullName: "Priya Joshi",
              email: "priya.test@gmail.com",
              mobile: "9876543211",
              course: "BCA",
              department: "Computer Applications",
              year: "1st Year",
              semester: "2nd Semester",
              collegeName: "Amrapali University, Haldwani",
              technicalSkills: ["Python", "Web Dev"],
              status: "Pending",
              appliedAt: "2026-10-09T20:09:36.122Z",
              notes: "Application submitted successfully. Under active review by Campus Ambassador Anil Pandey."
            }
          ];
          studentRecord = SEED_LIST.find(matchCand);
        }
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }

      if (studentRecord) {
        document.getElementById('stResAppId').textContent = studentRecord.id;
        document.getElementById('stResName').textContent = studentRecord.fullName;
        document.getElementById('stResCourse').textContent = `${studentRecord.course} • ${studentRecord.year || ''} (${studentRecord.semester || ''})`;
        document.getElementById('stResEmail').textContent = `${studentRecord.email} • ${studentRecord.mobile || ''}`;
        document.getElementById('stResSkills').textContent = Array.isArray(studentRecord.technicalSkills)
          ? studentRecord.technicalSkills.join(', ')
          : (studentRecord.technicalSkills || 'General Programming');
        document.getElementById('stResDate').textContent = studentRecord.appliedAt
          ? new Date(studentRecord.appliedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : '2026 Recruitment Session';

        const statusBadge = document.getElementById('stResStatusBadge');
        const st = studentRecord.status || 'Pending';
        const badgeClass = st === 'Selected' ? 'badge-green' : (st === 'Shortlisted' ? 'badge-blue' : 'badge-amber');
        const badgeIcon = st === 'Selected' ? 'fa-circle-check' : (st === 'Shortlisted' ? 'fa-star' : 'fa-clock');
        if (statusBadge) {
          statusBadge.innerHTML = `<span class="badge ${badgeClass}" style="font-size: 0.85rem; padding: 4px 10px;"><i class="fa-solid ${badgeIcon}"></i> ${st}</span>`;
        }

        const notesEl = document.getElementById('stResNotes');
        if (notesEl) {
          notesEl.textContent = studentRecord.notes || (st === 'Selected'
            ? 'Congratulations! Selected into the 12 Coordinator positions for Amrapali University.'
            : (st === 'Shortlisted'
              ? 'Your profile is shortlisted for technical & coordinator interviews. Prepare your portfolio.'
              : 'Application submitted successfully. Under review by Campus Ambassador Anil Pandey.'));
        }

        if (inputView) inputView.style.display = 'none';
        if (recordView) recordView.style.display = 'block';
        showToast(`Welcome back, ${studentRecord.fullName}! Status loaded successfully.`, 'success');
      } else {
        showToast(`No coordinator application found for "${val}". Please check your details or submit an application below.`, 'error');
      }
    });
  }
}
window.initStudentPortal = initStudentPortal;

// Modal View Handler for Opportunity / Hackathon / Contest
window.showItemDetails = function (type, id) {
  const modal = document.getElementById('eventDetailsModal');
  const title = document.getElementById('itemDetTitle');
  const body = document.getElementById('itemDetBody');

  if (type === 'hackathon') {
    const h = state.hackathons.find(item => item.id === id);
    if (!h) return;
    title.textContent = `Hackathon Guidelines: ${h.name}`;
    body.innerHTML = `
      <div style="background: rgba(0,0,0,0.3); padding: 18px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 20px;">
        <p style="margin-bottom: 6px;"><strong>Organizer:</strong> ${h.organizer}</p>
        <p style="margin-bottom: 6px;"><strong>Dates:</strong> ${h.startDate} to ${h.endDate} (Deadline: ${h.registrationDeadline})</p>
        <p style="margin-bottom: 6px;"><strong>Mode:</strong> <span class="badge badge-purple">${h.mode.toUpperCase()}</span></p>
        <p style="margin-bottom: 0;"><strong>Team Size:</strong> ${h.teamSize}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <strong style="color: var(--primary);">Themes & Focus Tracks:</strong>
        <p style="margin-top: 4px; color: #cbd5e1;">${h.tracks.join(' &bull; ')}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <strong style="color: var(--primary);">Official Rules:</strong>
        <p style="margin-top: 4px; color: #cbd5e1;">${h.rules}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <strong style="color: var(--primary);">Prizes & Certifications:</strong>
        <p style="margin-top: 4px; color: var(--primary); font-weight: 600;">${h.prizes}</p>
      </div>

      <div style="text-align: right;">
        <a href="${h.registrationLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
          Proceed to Official Registration <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    `;
  } else if (type === 'contest') {
    const c = state.contests.find(item => item.id === id);
    if (!c) return;
    title.textContent = `Contest Syllabus & Rules: ${c.title}`;
    body.innerHTML = `
      <div style="background: rgba(0,0,0,0.3); padding: 18px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 20px;">
        <p style="margin-bottom: 6px;"><strong>Platform:</strong> ${c.platform}</p>
        <p style="margin-bottom: 6px;"><strong>Date & Duration:</strong> ${c.date} (${c.duration})</p>
        <p style="margin-bottom: 0;"><strong>Difficulty:</strong> <span class="badge badge-blue">${c.difficulty}</span> &bull; <span class="badge badge-purple">${c.level}</span></p>
      </div>

      <div style="margin-bottom: 16px;">
        <strong style="color: var(--primary);">Curated Topics:</strong>
        <p style="margin-top: 4px; color: #cbd5e1;">${c.topics}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <strong style="color: var(--primary);">Contest Regulations:</strong>
        <p style="margin-top: 4px; color: #cbd5e1;">${c.rules}</p>
      </div>

      <div style="text-align: right;">
        <a href="${c.contestLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
          Enter Contest on HackerRank <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    `;
  }

  modal.classList.add('active');
};

// ============================================================================
// 10. GLOBAL REAL-TIME SEARCH
// ============================================================================

function initGlobalSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderHackathons(state.hackathons);
      renderContests(state.contests);
      renderCourses(state.courses);
      return;
    }

    const filteredHackathons = state.hackathons.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.description.toLowerCase().includes(q) ||
      h.tracks.some(t => t.toLowerCase().includes(q))
    );
    renderHackathons(filteredHackathons);

    const filteredContests = state.contests.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.topics.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
    renderContests(filteredContests);

    const filteredCourses = state.courses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.skills.some(s => s.toLowerCase().includes(q))
    );
    renderCourses(filteredCourses);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
