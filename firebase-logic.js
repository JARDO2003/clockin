/* ═══ FIRESTORE LOGIC ═══ */
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
