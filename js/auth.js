/* ============================================================
   auth.js — Sign up, login, logout, session state
   Depends on: supabase.js loaded before this in HTML
   Exposes globals: currentUser, openAuth(), closeAuth(), etc.
   ============================================================ */

let currentUser = null;

/* ── Open / close modal ── */
function openAuth(tab = 'login') {
  switchAuthTab(tab);
  document.getElementById('auth-modal').classList.add('open');
}

function closeAuth() {
  document.getElementById('auth-modal').classList.remove('open');
}

function closeModalOutside(event) {
  if (event.target === document.getElementById('auth-modal')) closeAuth();
}

/* ── Tab switcher ── */
function switchAuthTab(tab) {
  document.getElementById('login-form').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active',  tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
}

/* ── Login ── */
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('Please fill in all fields.'); return; }

  showToast('Signing in…');

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { showToast('Login failed: ' + error.message); return; }

  currentUser = {
    id:     data.user.id,
    name:   data.user.user_metadata.full_name || email.split('@')[0],
    email:  data.user.email,
    role:   data.user.user_metadata.role        || 'Researcher',
    inst:   data.user.user_metadata.institution || '',
    letter: (data.user.user_metadata.full_name || email)[0].toUpperCase()
  };

  closeAuth();
  updateNavUser();
  showToast('Welcome back, ' + currentUser.name + '!');
}

/* ── Sign up ── */
async function doSignup() {
  const fn    = document.getElementById('su-fname').value.trim();
  const ln    = document.getElementById('su-lname').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const role  = document.getElementById('su-role').value;
  const inst  = document.getElementById('su-inst').value.trim();
  const pass  = document.getElementById('su-pass').value;

  if (!fn || !ln || !email || !inst || !pass) { showToast('Please fill all fields.'); return; }
  if (pass.length < 8) { showToast('Password must be 8+ characters.'); return; }

  showToast('Creating account…');

  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options: {
      data: { full_name: fn + ' ' + ln, role, institution: inst }
    }
  });

  if (error) { showToast('Signup failed: ' + error.message); return; }

  currentUser = {
    id:     data.user.id,
    name:   fn + ' ' + ln,
    email,
    role,
    inst,
    letter: fn[0].toUpperCase()
  };

  closeAuth();
  updateNavUser();
  showToast('Account created! Check your email to confirm before logging in.');
}

/* ── Logout ── */
async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById('nav-right').innerHTML = `
    <button class="btn-nav" onclick="openAuth('login')">Sign In</button>
    <button class="btn-nav btn-nav-filled" onclick="openAuth('signup')">Join Free</button>
  `;
  showToast('Signed out.');
}

/* ── Update nav bar after login ── */
function updateNavUser() {
  const nr = document.getElementById('nav-right');
  nr.innerHTML = `
    <div class="profile-wrap">
      <div style="display:flex;align-items:center;gap:0.6rem;cursor:pointer;" onclick="toggleProfileMenu()">
        <div class="nav-avatar">${currentUser.letter}</div>
        <span class="nav-username">${currentUser.name.split(' ')[0]}</span>
        <span style="color:rgba(255,255,255,0.35);font-size:0.7rem;">▾</span>
      </div>
      <div class="profile-menu" id="profile-menu">
        <div class="pm-item" style="font-weight:600;color:var(--navy);">
          <div class="avatar ava" style="width:28px;height:28px;font-size:0.72rem;">${currentUser.letter}</div>
          <div>
            <div style="font-weight:600;">${currentUser.name}</div>
            <div style="font-size:0.7rem;color:var(--muted);font-weight:400;">${currentUser.role}</div>
          </div>
        </div>
        <div class="pm-sep"></div>
        <button class="pm-item" onclick="window.location.href='profile.html'">👤 My Profile</button>
        <button class="pm-item" onclick="window.location.href='myposts.html'">📝 My Posts</button>
        <button class="pm-item" onclick="window.location.href='saved.html'">🔖 Saved Posts</button>
        <div class="pm-sep"></div>
        <button class="pm-item" onclick="logout()" style="color:var(--red);">↩ Sign Out</button>
      </div>
    </div>
  `;
}

function toggleProfileMenu() {
  document.getElementById('profile-menu').classList.toggle('open');
}

/* ── Close dropdown when clicking outside ── */
document.addEventListener('click', e => {
  const wrap = document.querySelector('.profile-wrap');
  const menu = document.getElementById('profile-menu');
  if (menu && wrap && !wrap.contains(e.target)) menu.classList.remove('open');
});

/* ── Restore session on page load ── */
sb.auth.getSession().then(({ data: { session } }) => {
  if (!session) return;
  const u = session.user;
  currentUser = {
    id:     u.id,
    name:   u.user_metadata.full_name || u.email.split('@')[0],
    email:  u.email,
    role:   u.user_metadata.role        || 'Researcher',
    inst:   u.user_metadata.institution || '',
    letter: (u.user_metadata.full_name || u.email)[0].toUpperCase()
  };
  updateNavUser();
});
