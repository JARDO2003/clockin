/* ═══ LONG PRESS LOGIC ═══ */
const LP_DURATION = 1500; // ms
let lpTimer = null;
let lpAnimFrame = null;
let lpStart = null;

function startLongPress(e, btnId) {
  e.preventDefault();
  cancelLongPress(btnId);
  const btn = document.getElementById(btnId);
  const bar = document.getElementById('lp-bar-' + btnId);
  btn.classList.add('pressing');
  bar.style.width = '0%';
  bar.style.transition = 'none';
  // Force reflow
  bar.offsetHeight;
  bar.style.setProperty('--lp-dur', LP_DURATION + 'ms');
  bar.style.transition = 'width ' + LP_DURATION + 'ms linear';
  bar.style.width = '100%';
  bar.classList.add('active');
  lpTimer = setTimeout(() => {
    cancelLongPress(btnId);
    openAdmModal();
  }, LP_DURATION);
}

function cancelLongPress(btnId) {
  if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
  const btn = document.getElementById(btnId);
  const bar = document.getElementById('lp-bar-' + btnId);
  if (btn) btn.classList.remove('pressing');
  if (bar) {
    bar.style.transition = 'width .2s ease';
    bar.style.width = '0%';
    bar.classList.remove('active');
  }
}

/* ── Admin modal ── */
let admAttempts = 0;
const ADM_PASS = 'loko2022@';
const ADM_MAX  = 5;

function openAdmModal() {
  const ov = document.getElementById('adm-overlay');
  ov.classList.add('open');
  setTimeout(() => {
    const inp = document.getElementById('adm-pass');
    if (inp) inp.focus();
  }, 300);
  document.getElementById('adm-err').style.display = 'none';
  document.getElementById('adm-attempts').style.display = 'none';
  document.getElementById('adm-pass').value = '';
  document.getElementById('adm-btn').disabled = false;
  document.getElementById('adm-btn').innerHTML = '<span>Accéder au panneau</span>';
}

function closeAdmModal() {
  document.getElementById('adm-overlay').classList.remove('open');
  document.getElementById('adm-pass').value = '';
  document.getElementById('adm-err').style.display = 'none';
}

function admBgClose(e) {
  if (e.target === document.getElementById('adm-overlay')) closeAdmModal();
}

function toggleAdmEye() {
  const inp = document.getElementById('adm-pass');
  const eye = document.getElementById('adm-eye');
  if (inp.type === 'password') {
    inp.type = 'text'; eye.textContent = '🙈';
  } else {
    inp.type = 'password'; eye.textContent = '👁';
  }
}

function checkAdminPass() {
  const val = document.getElementById('adm-pass').value;
  const errEl = document.getElementById('adm-err');
  const attEl = document.getElementById('adm-attempts');
  const modal = document.getElementById('adm-modal');

  if (val === ADM_PASS) {
    admAttempts = 0;
    errEl.style.display = 'none';
    attEl.style.display = 'none';
    document.getElementById('adm-btn').innerHTML = '<span>✓ Accès accordé…</span>';
    document.getElementById('adm-btn').disabled = true;
    toast('Accès admin accordé ! Redirection…', 'ok');
    setTimeout(() => {
      closeAdmModal();
      window.location.href = 'admin.html';
    }, 700);
    return;
  }

  admAttempts++;
  modal.classList.remove('shake');
  void modal.offsetWidth; // reflow pour relancer l'animation
  modal.classList.add('shake');

  errEl.style.display = 'block';
  const remaining = ADM_MAX - admAttempts;
  if (remaining <= 0) {
    errEl.textContent = 'Trop de tentatives. Accès bloqué temporairement.';
    attEl.style.display = 'none';
    document.getElementById('adm-btn').disabled = true;
    document.getElementById('adm-btn').innerHTML = '<span>🔒 Bloqué (30s)</span>';
    setTimeout(() => {
      admAttempts = 0;
      document.getElementById('adm-btn').disabled = false;
      document.getElementById('adm-btn').innerHTML = '<span>Accéder au panneau</span>';
      errEl.style.display = 'none';
    }, 30000);
  } else {
    errEl.textContent = 'Mot de passe incorrect.';
    if (admAttempts >= 2) {
      attEl.style.display = 'block';
      attEl.textContent = remaining + ' tentative' + (remaining > 1 ? 's' : '') + ' restante' + (remaining > 1 ? 's' : '');
    }
  }
  document.getElementById('adm-pass').value = '';
}

/* ── Auth modal helpers ── */
function openAuth(tab){document.getElementById('overlay').classList.add('open');switchP(tab);}
function closeAuth(){document.getElementById('overlay').classList.remove('open');}
function bgClose(e){if(e.target===document.getElementById('overlay'))closeAuth();}
function switchP(p){
  document.querySelectorAll('.panel').forEach(el=>el.classList.remove('on'));
  document.getElementById('p-'+p).classList.add('on');
  document.getElementById('tab-l').classList.toggle('on',p==='login');
  document.getElementById('tab-r').classList.toggle('on',p==='register');
}
function prevPhoto(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    document.getElementById('pre-img').src=ev.target.result;
    document.getElementById('pre-nm').textContent=f.name;
    document.getElementById('photo-pre').style.display='flex';
  };r.readAsDataURL(f);
}
function toast(msg,type){const d=document.createElement('div');d.className='toast t-'+type;d.textContent=msg;document.getElementById('toasts').appendChild(d);setTimeout(()=>d.remove(),4000);}
window.toast=toast;
