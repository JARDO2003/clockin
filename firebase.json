import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const FC = {
  apiKey:"AIzaSyCPGgtXoDUycykLaTSee0S0yY0tkeJpqKI",
  authDomain:"data-com-a94a8.firebaseapp.com",
  projectId:"data-com-a94a8",
  storageBucket:"data-com-a94a8.firebasestorage.app",
  messagingSenderId:"276904640935",
  appId:"1:276904640935:web:9cd805aeba6c34c767f682"
};
const app = initializeApp(FC);
const db  = getFirestore(app);
window._db = db;
window._FS = { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot, serverTimestamp };

/* ── Check session ── */
const sess = sessionStorage.getItem('uttloko_user');
if (sess) {
  try {
    const u = JSON.parse(sess);
    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
      const adminLink = u.role==='admin'
        ? '<a href="admin.html" style="padding:9px 18px;border-radius:10px;border:none;background:var(--lime);color:var(--bg);font-size:.85rem;font-weight:700;text-decoration:none">\uD83D\uDEE1\uFE0F Admin</a>'
        : '';
      navActions.innerHTML =
        '<span style="font-size:.82rem;color:var(--muted);padding:0 6px">\uD83D\uDC4B ' + (u.prenom||'') + '</span>' +
        '<a href="dashboard.html" style="padding:9px 18px;border-radius:10px;border:1px solid rgba(168,230,61,.3);background:rgba(168,230,61,.08);color:var(--lime);font-size:.85rem;font-weight:600;text-decoration:none">\u23F1 Mon espace</a>' +
        adminLink +
        '<button onclick="sessionStorage.removeItem(\'uttloko_user\');location.reload()" style="padding:9px 16px;border-radius:10px;border:1px solid rgba(239,68,68,.2);background:transparent;color:#fca5a5;font-size:.82rem;cursor:pointer">D\u00E9co</button>';
    }
  } catch(e) {}
}

/* ── Live stats ── */
onSnapshot(collection(db, 'users'), snap => {
  document.getElementById('s-users').textContent = snap.size;
});
const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
onSnapshot(collection(db, `clockins_${today}`), snap => {
  document.getElementById('s-today').textContent = snap.size;
});

/* ── Hash password (SHA-256) ── */
async function hashPass(pass) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ── LOGIN ── */
window.doLogin = async () => {
  const email = document.getElementById('l-email').value.trim().toLowerCase();
  const pass  = document.getElementById('l-pass').value;
  if (!email || !pass) { showErr('l-err','Veuillez remplir tous les champs.'); return; }
  setLoad('l-btn', true);
  try {
    const q = query(collection(db,'users'), where('email','==',email), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) { showErr('l-err','Aucun compte avec cet email.'); setLoad('l-btn',false,'Accéder à mon espace'); return; }
    const userDoc = snap.docs[0];
    const userData = userDoc.data();
    const hashed = await hashPass(pass);
    if (userData.password !== hashed) { showErr('l-err','Mot de passe incorrect.'); setLoad('l-btn',false,'Accéder à mon espace'); return; }
    const session = { uid: userDoc.id, ...userData };
    delete session.password;
    sessionStorage.setItem('uttloko_user', JSON.stringify(session));
    toast('Connexion réussie ! Redirection...','ok');
    setTimeout(() => {
      window.location.href = userData.role === 'admin' ? 'admin.html' : 'dashboard.html';
    }, 800);
  } catch(e) {
    showErr('l-err', 'Erreur : ' + (e.message || e));
    setLoad('l-btn', false, 'Accéder à mon espace');
  }
};

/* ── Resize image to base64 ── */
function resizeToBase64(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 200;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.80));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── REGISTER ── */
window.doRegister = async () => {
  const nom     = document.getElementById('r-nom').value.trim();
  const prenom  = document.getElementById('r-prenom').value.trim();
  const contact = document.getElementById('r-contact').value.trim();
  const email   = document.getElementById('r-email').value.trim().toLowerCase();
  const dept    = document.getElementById('r-dept').value.trim();
  const pass    = document.getElementById('r-pass').value;
  const file    = document.getElementById('r-photo').files[0];
  if (!nom||!prenom||!contact||!email||!dept||!pass) { showErr('r-err','Veuillez remplir tous les champs.'); return; }
  if (pass.length < 8) { showErr('r-err','Mot de passe trop court (8 car. minimum).'); return; }
  setLoad('r-btn', true);
  try {
    const q = query(collection(db,'users'), where('email','==',email), limit(1));
    const exist = await getDocs(q);
    if (!exist.empty) { showErr('r-err','Un compte avec cet email existe déjà.'); setLoad('r-btn',false,'Créer mon compte'); return; }
    const photoBase64 = await resizeToBase64(file);
    const hashed = await hashPass(pass);
    const uid = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    await setDoc(doc(db,'users',uid), {
      uid, nom, prenom, contact, email, dept,
      photoURL: photoBase64,
      password: hashed, role:'teacher', createdAt: serverTimestamp()
    });
    const session = { uid, nom, prenom, contact, email, dept, photoURL: photoBase64, role:'teacher' };
    sessionStorage.setItem('uttloko_user', JSON.stringify(session));
    toast('Bienvenue ' + prenom + ' ! Redirection...','ok');
    setTimeout(() => window.location.href = 'dashboard.html', 900);
  } catch(e) {
    showErr('r-err', e.message || 'Erreur lors de la création.');
    setLoad('r-btn', false, 'Créer mon compte');
  }
};

function showErr(id,msg){const el=document.getElementById(id);el.textContent=msg;el.style.display='block';setTimeout(()=>el.style.display='none',5000);}
function setLoad(id,on,label=''){const b=document.getElementById(id);b.disabled=on;b.innerHTML=on?'<div class="spinner"></div>':`<span>${label}</span>`;}

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


// Enregistrement du Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[PWA] SW enregistré:', registration.scope);
        
        // Mise à jour du SW
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouvelle version disponible
              if (confirm('Une nouvelle version d\'UTT LOKO est disponible. Recharger ?')) {
                location.reload();
              }
            }
          });
        });
      })
      .catch(err => console.error('[PWA] Erreur SW:', err));
  });
}

// Gestion de l'installation PWA
let deferredPrompt;
const installBanner = document.getElementById('pwa-install');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Afficher le banner après 3 secondes
  setTimeout(() => {
    if (!localStorage.getItem('pwa-dismissed')) {
      installBanner.style.display = 'block';
    }
  }, 3000);
});

// Cacher le banner si déjà installé
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installée');
  installBanner.style.display = 'none';
  deferredPrompt = null;
  localStorage.setItem('pwa-installed', 'true');
});

function installPWA() {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('[PWA] Installation acceptée');
      localStorage.setItem('pwa-installed', 'true');
    } else {
      console.log('[PWA] Installation refusée');
    }
    installBanner.style.display = 'none';
    deferredPrompt = null;
  });
}

function dismissPWA() {
  installBanner.style.display = 'none';
  localStorage.setItem('pwa-dismissed', 'true');
  // Réafficher dans 7 jours
  setTimeout(() => {
    localStorage.removeItem('pwa-dismissed');
  }, 7 * 24 * 60 * 60 * 1000);
}

// Détection mode standalone (app installée)
if (window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone === true) {
  console.log('[PWA] Mode standalone actif');
  document.body.classList.add('pwa-standalone');
}

// Gestion du offline/online
window.addEventListener('online', () => {
  toast('Connexion rétablie !', 'ok');
});

window.addEventListener('offline', () => {
  toast('Mode hors ligne. Certaines fonctionnalités peuvent être limitées.', 'info');
});
