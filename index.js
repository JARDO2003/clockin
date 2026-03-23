import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs,
  addDoc, query, where, orderBy, limit, onSnapshot,
  updateDoc, deleteDoc, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const FC={apiKey:"AIzaSyCPGgtXoDUycykLaTSee0S0yY0tkeJpqKI",authDomain:"data-com-a94a8.firebaseapp.com",projectId:"data-com-a94a8",storageBucket:"data-com-a94a8.firebasestorage.app",messagingSenderId:"276904640935",appId:"1:276904640935:web:9cd805aeba6c34c767f682"};
const app=initializeApp(FC);
const db=getFirestore(app);
window._db=db;
window._FS={collection,doc,setDoc,getDoc,getDocs,addDoc,query,where,orderBy,limit,onSnapshot,updateDoc,deleteDoc,serverTimestamp,increment};

const sess=sessionStorage.getItem('uttloko_user');
const U=sess ? JSON.parse(sess) : {role:'teacher',nom:'Visiteur',prenom:'Mode',uid:'guest',dept:'',photoURL:''};
window._U=U;

const init=((U.prenom||'?')[0]+(U.nom||'?')[0]).toUpperCase();
document.getElementById('u-init').textContent=init;
document.getElementById('u-nm').textContent=sess ? `${U.prenom} ${U.nom}` : 'Non connecté';
document.getElementById('u-rl').textContent=sess ? (U.dept||'Enseignant') : 'Visiteur';
document.getElementById('cp-init').textContent=init;
if(U.photoURL){
  document.getElementById('u-av').innerHTML=`<img src="${U.photoURL}">`;
  document.getElementById('cp-av').innerHTML=`<img src="${U.photoURL}">`;
}

window._geoOk=false;window._locCfg=null;window._ckType=null;window._stream=null;
window._mFile=null;window._mType=null;window._mediaRec=null;window._recChunks=[];

/* ── Load location config ── */
(async()=>{
  const s=await getDoc(doc(db,'config','location'));
  if(s.exists())window._locCfg=s.data();
})();

/* ── Haversine ── */
function haversine(la1,lo1,la2,lo2){
  const R=6371e3,p=Math.PI/180;
  const a=Math.sin((la2-la1)*p/2)**2+Math.cos(la1*p)*Math.cos(la2*p)*Math.sin((lo2-lo1)*p/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function setGeo(t,msg){
  const b=document.getElementById('geo-bar');
  b.className='geo-bar gb-'+t;
  document.getElementById('geo-txt').textContent=msg;
}
if(navigator.geolocation){
  setGeo('load','Localisation en cours...');
  navigator.geolocation.watchPosition(pos=>{
    if(!window._locCfg){setGeo('load','Zone GPS non configurée par l\'admin.');return;}
    const d=haversine(pos.coords.latitude,pos.coords.longitude,window._locCfg.lat,window._locCfg.lng);
    const r=window._locCfg.radius||200;
    window._geoOk=d<=r;
    if(window._geoOk)setGeo('ok',`📍 Dans l'établissement — ${Math.round(d)}m du centre`);
    else setGeo('warn',`🚫 Hors établissement — ${Math.round(d)}m (max: ${r}m)`);
  },()=>{window._geoOk=false;setGeo('warn','GPS indisponible. Activez la géolocalisation.');},{enableHighAccuracy:true,timeout:12000});
}else setGeo('warn','Géolocalisation non supportée sur cet appareil.');

/* ── Load today status ── */
const todayKey=new Date().toISOString().slice(0,10).replace(/-/g,'');
async function loadToday(){
  const s=await getDoc(doc(db,`clockins_${todayKey}`,U.uid));
  if(!s.exists()){setRing('idle');return;}
  const d=s.data();
  if(d.clockin){
    document.getElementById('in-t').textContent=fmtT(d.clockin.ts?.toDate?.()|| new Date(d.clockin.tsMs));
    document.getElementById('btn-in').disabled=true;
    document.getElementById('btn-out').disabled=false;
    setRing(d.clockin.late?'late':'in');
  }
  if(d.clockout){
    document.getElementById('out-t').textContent=fmtT(d.clockout.ts?.toDate?.()|| new Date(d.clockout.tsMs));
    document.getElementById('btn-out').disabled=true;
    setRing('done');
    if(d.clockin){
      const ms=d.clockout.tsMs-d.clockin.tsMs;
      document.getElementById('dur-t').textContent=(ms/3600000).toFixed(1)+'h';
    }
  }
}
loadToday();
function fmtT(d){return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}

function setRing(state){
  const m={
    idle:{e:'🕐',s:'Prêt',sub:'Démarrez votre journée',off:535,c:'#627a6e'},
    in:{e:'✅',s:'Présent',sub:'Bonne journée !',off:0,c:'#a8e63d'},
    late:{e:'⚠️',s:'En retard',sub:'Explication soumise',off:0,c:'#f97316'},
    done:{e:'🏠',s:'Terminé',sub:'À demain !',off:200,c:'#a8e63d'},
  };
  const v=m[state]||m.idle;
  document.getElementById('rc-e').textContent=v.e;
  document.getElementById('rc-s').textContent=v.s;
  document.getElementById('rc-sub').textContent=v.sub;
  document.getElementById('r-pg').style.strokeDashoffset=v.off;
  document.getElementById('r-pg').style.stroke=v.c;
  document.getElementById('r-gl').style.strokeDashoffset=v.off;
  document.getElementById('r-gl').style.stroke=v.c;
}

/* ── CLOCK START ── */
window.startClock=type=>{
  if(!window._geoOk){toast('Vous devez être dans l\'établissement pour pointer !','err');return;}
  window._ckType=type;
  document.getElementById('face-title').textContent=type==='in'?'✅ Validation Clock IN':'🔴 Validation Clock OUT';
  document.getElementById('face-ov').classList.add('open');
  openCam();
};

/* ── CAMERA ── */
function fStep(n){for(let i=1;i<=3;i++){const d=document.getElementById('fd'+i);d.className='fs-d'+(i<n?' done':i===n?' active':'');}}
function openCam(){
  fStep(1);
  document.getElementById('face-st').textContent='Démarrage caméra...';
  document.getElementById('btn-cap').disabled=true;
  document.getElementById('btn-cap').textContent='🎥 Démarrer l\'enregistrement';
  document.getElementById('btn-cap').className='btn-cap';
  navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false})
    .then(s=>{
      window._stream=s;
      document.getElementById('face-vid').srcObject=s;
      document.getElementById('face-st').textContent='Centrez votre visage · cliquez pour enregistrer 2s.';
      document.getElementById('btn-cap').disabled=false;
      fStep(2);
    })
    .catch(()=>{document.getElementById('face-st').textContent='❌ Accès caméra refusé.';});
}
function stopCam(){
  if(window._stream){window._stream.getTracks().forEach(t=>t.stop());window._stream=null;}
}
window.closeFace=()=>{
  document.getElementById('face-ov').classList.remove('open');
  stopCam();
  stopRecording();
};

/* ── 2-SECOND VIDEO RECORDING ── */
function stopRecording(){
  if(window._mediaRec&&window._mediaRec.state!=='inactive'){
    try{window._mediaRec.stop();}catch(e){}
  }
  window._mediaRec=null;
  window._recChunks=[];
  document.getElementById('rec-ind').classList.remove('active');
  document.getElementById('cd-wrap').classList.remove('active');
}

window.doCapture=async()=>{
  const btn=document.getElementById('btn-cap');
  if(btn.disabled)return;
  btn.disabled=true;
  fStep(3);

  if(!window._stream){
    await finalizeClock('','');
    return;
  }

  // Determine supported MIME
  const mimeTypes=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'];
  let mimeType=mimeTypes.find(m=>MediaRecorder.isTypeSupported(m))||'';

  window._recChunks=[];
  let rec;
  try{
    rec=new MediaRecorder(window._stream,mimeType?{mimeType}:{});
  }catch(e){
    rec=new MediaRecorder(window._stream);
    mimeType=rec.mimeType||'video/webm';
  }
  window._mediaRec=rec;

  rec.ondataavailable=e=>{if(e.data&&e.data.size>0)window._recChunks.push(e.data);};

  rec.onstop=async()=>{
    stopCam();
    const blob=new Blob(window._recChunks,{type:mimeType||'video/webm'});
    window._recChunks=[];

    // Show upload progress
    const upBar=document.getElementById('vid-up-bar');
    const upFill=document.getElementById('vid-up-fill');
    const upPct=document.getElementById('vid-up-pct');
    upBar.style.display='block';
    upFill.style.width='0%';
    upPct.textContent='0%';
    document.getElementById('face-st').textContent='Envoi de la vidéo...';

    // Upload to Cloudinary
    let videoURL='';
    try{
      const fd=new FormData();
      fd.append('file',blob,'face_clock.webm');
      fd.append('upload_preset','database');
      fd.append('resource_type','video');
      const url=await new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest();
        xhr.upload.addEventListener('progress',ev=>{
          if(ev.lengthComputable){
            const p=Math.round(ev.loaded/ev.total*100);
            upFill.style.width=p+'%';
            upPct.textContent=p+'%';
          }
        });
        xhr.addEventListener('load',()=>{
          try{
            const j=JSON.parse(xhr.responseText);
            resolve(j.secure_url||'');
          }catch(e){resolve('');}
        });
        xhr.addEventListener('error',()=>resolve(''));
        xhr.open('POST','https://api.cloudinary.com/v1_1/djxcqczh1/video/upload');
        xhr.send(fd);
      });
      videoURL=url;
      upFill.style.width='100%';
      upPct.textContent='100%';
      setTimeout(()=>{upBar.style.display='none';},600);
    }catch(e){
      upBar.style.display='none';
      console.warn('Video upload failed',e);
    }

    document.getElementById('face-ov').classList.remove('open');
    await finalizeClock('',videoURL);
  };

  // Start recording
  rec.start(200); // collect chunks every 200ms
  document.getElementById('rec-ind').classList.add('active');
  document.getElementById('cd-wrap').classList.add('active');
  document.getElementById('face-st').textContent='Enregistrement en cours... 2 secondes';
  btn.className='btn-cap recording';
  btn.innerHTML='<div class="spinner"></div> Enregistrement...';

  // Countdown UI
  const cdProg=document.getElementById('cd-prog');
  const cdNum=document.getElementById('cd-num');
  const DURATION=2000;
  const START=Date.now();
  const raf=()=>{
    const elapsed=Date.now()-START;
    const pct=Math.min(elapsed/DURATION,1);
    const offset=282*pct; // full circumference ~282
    cdProg.style.strokeDashoffset=offset;
    cdNum.textContent=Math.max(0,Math.ceil((DURATION-elapsed)/1000));
    if(elapsed<DURATION)requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  // Stop after 2 seconds
  setTimeout(()=>{
    if(window._mediaRec&&window._mediaRec.state==='recording'){
      window._mediaRec.stop();
    }
    document.getElementById('rec-ind').classList.remove('active');
    document.getElementById('cd-wrap').classList.remove('active');
  },DURATION);
};

/* ── FINALIZE CLOCK ── */
async function finalizeClock(faceBase64,faceVideoURL){
  const now=new Date();
  const type=window._ckType;
  let limH=9,limM=0;
  try{
    const sc=await getDoc(doc(db,'config','settings'));
    if(sc.exists()){
      const [h,m]=(sc.data().clockinLimit||'09:00').split(':').map(Number);
      limH=h;limM=m;
    }
  }catch{}
  const late=type==='in'&&(now.getHours()>limH||(now.getHours()===limH&&now.getMinutes()>limM));
  const payload={
    ts:serverTimestamp(),
    tsMs:now.getTime(),
    faceBase64:faceBase64||'',
    faceVideoURL:faceVideoURL||'',
    faceOk:!!(faceBase64||faceVideoURL),
    late,
    userName:`${U.prenom} ${U.nom}`,
    dept:U.dept||''
  };

  const ref=doc(db,`clockins_${todayKey}`,U.uid);
  const existing=await getDoc(ref);
  if(existing.exists()){
    await updateDoc(ref,{[type==='in'?'clockin':'clockout']:payload});
  }else{
    await setDoc(ref,{uid:U.uid,[type==='in'?'clockin':'clockout']:payload});
  }
  toast(type==='in'?'✅ Clock IN enregistré !':'🔴 Clock OUT enregistré !','ok');
  loadToday();
  if(late){
    setTimeout(()=>{
      const h=String(now.getHours()).padStart(2,'0');
      const m=String(now.getMinutes()).padStart(2,'0');
      document.getElementById('exp-heure').value=`${h}:${m}`;
      document.getElementById('exp-ov').classList.add('open');
    },700);
  }
}

/* ── EXPLANATION ── */
window.submitExp=async()=>{
  const reason=document.getElementById('exp-r').value;
  const heure=document.getElementById('exp-heure').value;
  const details=document.getElementById('exp-det').value.trim();
  if(!reason||!heure){const e=document.getElementById('exp-err');e.textContent='Veuillez sélectionner une raison et l\'heure.';e.style.display='block';setTimeout(()=>e.style.display='none',4000);return;}
  await addDoc(collection(db,'explanations'),{
    uid:U.uid,userName:`${U.prenom} ${U.nom}`,reason,heure,details,ts:serverTimestamp(),tsMs:Date.now()
  });
  document.getElementById('exp-ov').classList.remove('open');
  toast('Explication envoyée à l\'administration','ok');
};

/* ── HISTORY ── */
async function loadHistory(){
  const el=document.getElementById('hist-list');
  const entries=[];
  const today=new Date();
  for(let i=0;i<30;i++){
    const d=new Date(today);d.setDate(d.getDate()-i);
    const dk=d.toISOString().slice(0,10).replace(/-/g,'');
    try{
      const s=await getDoc(doc(db,`clockins_${dk}`,U.uid));
      if(s.exists())entries.push({dk,...s.data()});
    }catch{}
  }
  let days=0,lates=0;
  el.innerHTML=entries.map(e=>{
    if(!e.clockin&&!e.clockout)return'';
    days++;
    const late=e.clockin?.late;if(late)lates++;
    const inn=e.clockin?fmtT(new Date(e.clockin.tsMs)):'—';
    const out=e.clockout?fmtT(new Date(e.clockout.tsMs)):'—';
    const dk=e.dk;
    const dn=new Date(dk.replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3')).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    return`<div class="hist-row">
      <div class="hr-ico ${late?'hr-out':'hr-in'}">${late?'⚠️':'✅'}</div>
      <div class="hr-inf"><div class="hr-t">${inn} → ${out}</div><div class="hr-d">${dn}</div></div>
      <span class="badge ${late?'b-org':'b-lime'}">${late?'Retard':'À l\'heure'}</span>
    </div>`;
  }).filter(Boolean).join('')||'<div style="text-align:center;padding:20px;color:var(--muted)">Aucun pointage</div>';
  document.getElementById('s-days').textContent=days;
  document.getElementById('s-late').textContent=lates;
  document.getElementById('s-rate').textContent=days>0?Math.round((1-lates/days)*100)+'%':'—';
}

/* ── COMMUNITY ── */
window.pickMedia=(e,type)=>{
  const f=e.target.files[0];if(!f)return;
  window._mFile=f;window._mType=type;
  const r=new FileReader();
  r.onload=ev=>{
    const z=document.getElementById('media-zone');z.style.display='block';
    const tag=type==='image'?`<img src="${ev.target.result}">`:`<video src="${ev.target.result}" controls></video>`;
    z.innerHTML=`<button class="media-rm" onclick="rmMedia()">✕</button>${tag}`;
  };r.readAsDataURL(f);
};
window.rmMedia=()=>{
  window._mFile=null;window._mType=null;
  const z=document.getElementById('media-zone');z.style.display='none';z.innerHTML='';
  document.getElementById('pick-img').value='';
  document.getElementById('pick-vid').value='';
};
window.publishPost=async()=>{
  const txt=document.getElementById('post-txt').value.trim();
  if(!txt&&!window._mFile){toast('Écrivez quelque chose à partager !','err');return;}
  const btn=document.getElementById('pub-btn');btn.disabled=true;
  btn.innerHTML='<div class="spinner" style="width:14px;height:14px"></div>';
  let mediaURL='',mediaType='';
  if(window._mFile){
    const prog=document.getElementById('upload-progress');
    const fill=document.getElementById('up-fill');
    const pct=document.getElementById('up-pct');
    prog.style.display='block';fill.style.width='0%';pct.textContent='0%';
    try{
      const ep=window._mType==='video'?'https://api.cloudinary.com/v1_1/djxcqczh1/video/upload':'https://api.cloudinary.com/v1_1/djxcqczh1/image/upload';
      const fd=new FormData();fd.append('file',window._mFile);fd.append('upload_preset','database');
      const j=await new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest();
        xhr.upload.addEventListener('progress',e=>{
          if(e.lengthComputable){const p=Math.round(e.loaded/e.total*100);fill.style.width=p+'%';pct.textContent=p+'%';}
        });
        xhr.addEventListener('load',()=>{try{resolve(JSON.parse(xhr.responseText));}catch(e){reject(e);}});
        xhr.addEventListener('error',reject);
        xhr.open('POST',ep);xhr.send(fd);
      });
      fill.style.width='100%';pct.textContent='100%';
      setTimeout(()=>{prog.style.display='none';},600);
      mediaURL=j.secure_url||'';mediaType=window._mType||'';
    }catch(e){
      prog.style.display='none';
      toast('Erreur upload média','err');
      btn.disabled=false;btn.innerHTML='Publier →';return;
    }
  }
  if(mediaURL&&mediaURL.includes('cloudinary.com')){
    mediaURL=mediaURL.replace('/upload/','/upload/f_auto,q_auto/');
  }
  await addDoc(collection(db,'posts'),{
    txt,mediaURL,mediaType,uid:U.uid,
    uName:`${U.prenom} ${U.nom}`,uPhoto:U.photoURL||'',uDept:U.dept||'',
    ts:serverTimestamp(),tsMs:Date.now(),likes:{},likeCount:0,shareCount:0,commentCount:0
  });
  document.getElementById('post-txt').value='';
  rmMedia();
  btn.disabled=false;btn.innerHTML='Publier →';
  toast('Publication envoyée !','ok');
};

function loadFeed(){
  const q=query(collection(db,'posts'),orderBy('tsMs','desc'),limit(30));
  onSnapshot(q,snap=>{
    const feed=document.getElementById('feed');
    if(snap.empty){feed.innerHTML='<div style="text-align:center;padding:38px;color:var(--muted)">Aucune publication. Soyez le premier !</div>';return;}
    feed.innerHTML=snap.docs.map(d=>{
      const p=d.data();const id=d.id;
      const av=p.uPhoto?`<img src="${p.uPhoto}">`:`<span>${(p.uName||'?')[0]}</span>`;
      const tm=new Date(p.tsMs).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      const lc=p.likeCount||0;const cc=p.commentCount||0;const liked=p.likes&&p.likes[U.uid];
      const media=p.mediaURL?(p.mediaType==='video'?`<video class="post-vid" src="${p.mediaURL}" crossorigin="anonymous" referrerpolicy="no-referrer" controls></video>`:`<img class="post-img" src="${p.mediaURL}" crossorigin="anonymous" referrerpolicy="no-referrer" onclick="window.open('${p.mediaURL}','_blank')">`): '';
      return`<div class="post" id="post-${id}">
        <div class="post-hd">
          <div class="p-av">${av}</div>
          <div><div class="p-nm">${p.uName||'—'}</div><div class="p-tm">${p.uDept?p.uDept+' · ':''}${tm}</div></div>
          <span class="p-dept">Enseignant</span>
        </div>
        ${p.txt?`<div class="post-txt">${p.txt}</div>`:''}
        ${media}
        <div class="post-acts">
          <button class="act-b ${liked?'liked':''}" onclick="toggleLike('${id}',${!!liked})">❤️ ${lc} J'aime</button>
          <button class="act-b" onclick="toggleComments('${id}')">💬 ${cc} Commenter</button>
          <button class="act-b" onclick="sharePost('${p.uName||''}')">🔗 Partager</button>
        </div>
        <div class="comments-wrap" id="cmts-${id}">
          <div class="comment-list" id="cmt-list-${id}"><div class="no-cmts">Chargement...</div></div>
          <div class="cmt-compose">
            <div class="cmt-av">${U.photoURL?`<img src="${U.photoURL}">`:`<span>${((U.prenom||'?')[0]).toUpperCase()}</span>`}</div>
            <input class="cmt-inp" id="cmt-inp-${id}" placeholder="Écrire un commentaire..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendComment('${id}');}">
            <button class="cmt-send" onclick="sendComment('${id}')">Envoyer</button>
          </div>
        </div>
      </div>`;
    }).join('');
  });
}

window.toggleComments=(postId)=>{
  const wrap=document.getElementById('cmts-'+postId);
  const isOpen=wrap.classList.contains('open');
  if(isOpen){wrap.classList.remove('open');return;}
  wrap.classList.add('open');
  loadComments(postId);
};
function loadComments(postId){
  const list=document.getElementById('cmt-list-'+postId);
  if(!list)return;
  const q=query(collection(db,`posts/${postId}/comments`),orderBy('tsMs','asc'),limit(50));
  if(window._cmtUnsub&&window._cmtUnsub[postId])window._cmtUnsub[postId]();
  if(!window._cmtUnsub)window._cmtUnsub={};
  window._cmtUnsub[postId]=onSnapshot(q,snap=>{
    if(!document.getElementById('cmt-list-'+postId))return;
    if(snap.empty){list.innerHTML='<div class="no-cmts">Aucun commentaire. Soyez le premier !</div>';return;}
    list.innerHTML=snap.docs.map(d=>{
      const c=d.data();
      const av=c.uPhoto?`<img src="${c.uPhoto}">`:`<span>${(c.uName||'?')[0]}</span>`;
      const tm=new Date(c.tsMs).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      return`<div class="cmt"><div class="cmt-av">${av}</div><div class="cmt-body"><div class="cmt-nm">${c.uName||'—'}</div><div class="cmt-txt">${c.txt||''}</div><div class="cmt-ts">${tm}</div></div></div>`;
    }).join('');
  });
}
window.sendComment=async(postId)=>{
  const inp=document.getElementById('cmt-inp-'+postId);
  const txt=(inp?.value||'').trim();if(!txt)return;
  inp.value='';inp.disabled=true;
  try{
    await addDoc(collection(db,`posts/${postId}/comments`),{txt,uid:U.uid,uName:`${U.prenom} ${U.nom}`,uPhoto:U.photoURL||'',ts:serverTimestamp(),tsMs:Date.now()});
    await updateDoc(doc(db,'posts',postId),{commentCount:increment(1)});
  }catch(e){toast('Erreur commentaire','err');}
  inp.disabled=false;inp.focus();
};
window.toggleLike=async(id,isLiked)=>{
  const ref=doc(db,'posts',id);
  if(isLiked){await updateDoc(ref,{[`likes.${U.uid}`]:false,likeCount:increment(-1)});}
  else{await updateDoc(ref,{[`likes.${U.uid}`]:true,likeCount:increment(1)});}
};
window.sharePost=()=>{navigator.clipboard.writeText(location.href).then(()=>toast('Lien copié !','ok'));};
window.doLogout=()=>{sessionStorage.removeItem('uttloko_user');location.href='index.html';};

function toast(msg,type){const d=document.createElement('div');d.className='toast t-'+type;d.textContent=msg;document.getElementById('toasts').appendChild(d);setTimeout(()=>d.remove(),4000);}
window.toast=toast;

/* Init */
loadFeed();
document.querySelectorAll('.tb').forEach(t=>t.addEventListener('click',()=>{
  if(document.getElementById('pg-history').classList.contains('on'))loadHistory();
}));

function tick(){
  const now=new Date();
  document.getElementById('live-h').textContent=now.toLocaleTimeString('fr-FR');
  document.getElementById('live-d').textContent=now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
tick();setInterval(tick,1000);
function goTab(id,el){
  document.querySelectorAll('.tb').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('pg-'+id).classList.add('on');
  if(id==='history')loadHistory();
}
