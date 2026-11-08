// SIGNTAX-ERA — Header bersama untuk semua halaman:
//   🔍 Cari toko   🔔 Notifikasi (dihitung otomatis dari data)   👤 Profil & status sistem
// Memakai data yang sama dengan AI Prediksi (risk-ai.js) + Database Store Leader (cloud).
(function(){
  const API_BASE=/netlify\.app$/.test(location.hostname)?'':'https://signtax-era.netlify.app';
  const USER={name:'Ghesang Pratano',role:'PIC SIGNTAX-ERA',unit:'VMD Planogram & Visibility Asst. Manager — RMO Region 5'};
  let A=null,SLDB={},loading=null;

  // ── DATA ──────────────────────────────────────────────────────────────────
  function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);})}
  async function loadSL(){
    try{const r=await fetch(API_BASE+'/.netlify/functions/settings-sync?key=sldb',{cache:'no-store'});const d=r.ok?await r.json():null;if(d&&Object.keys(d).length){SLDB=d;return;}}catch(e){}
    try{SLDB=JSON.parse(localStorage.getItem('signtaxera_sldb'))||{}}catch(e){SLDB={}}
  }
  function ensureData(){
    if(!loading)loading=(async()=>{
      if(!window.SignRisk)await loadScript('risk-ai.js');
      const[stores]=await Promise.all([SignRisk.loadStores(),loadSL()]);
      A=SignRisk.analyze(stores);
      return A;
    })();
    return loading;
  }
  const sl=k=>{const s=SLDB[String(k).toUpperCase()];return s&&s.phone?s:null};
  const inWin=d=>d!=null&&((d>=55&&d<=65)||(d>=25&&d<=35)||(d>=3&&d<=10));
  const lvlOf=d=>d<=10?'H-7':d<=35?'H-30':'H-60';
  function rp(n){if(!n)return'Rp 0';if(n>=1e9)return'Rp '+(n/1e9).toFixed(2)+' M';if(n>=1e6)return'Rp '+(n/1e6).toFixed(1)+' jt';return'Rp '+Math.round(n).toLocaleString('id-ID')}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtD=s=>{if(!s)return'—';const d=new Date(s);return isNaN(d)?'—':d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})};

  // ── NOTIFIKASI ────────────────────────────────────────────────────────────
  function buildNotifs(){
    const L=A.list,belum=L.filter(x=>!x.lunas),out=[];
    belum.filter(x=>x.days!=null&&x.days<0).forEach(x=>out.push({sev:'red',ico:'⛔',title:`${x.nama} lewat jatuh tempo ${-x.days} hari`,sub:`${x.kode} · denda 1%/bulan berjalan`,href:`reminder-v2.html?kode=${x.kode}&level=H-7`}));
    belum.filter(x=>inWin(x.days)).sort((a,b)=>a.days-b.days).forEach(x=>out.push({sev:x.days<=10?'red':x.days<=35?'amber':'blue',ico:'🔔',title:`${x.nama} masuk window ${lvlOf(x.days)}`,sub:`${x.kode} · jatuh tempo ${fmtD(x.jt)} (${x.days} hari) · kirim reminder`,href:`reminder-v2.html?kode=${x.kode}&level=${lvlOf(x.days)}`}));
    belum.filter(x=>x.days!=null&&!inWin(x.days)&&[66,67,68,36,37,38,11,12,13].includes(x.days)).sort((a,b)=>a.days-b.days).forEach(x=>{
      const target=x.days>=66?'H-60':x.days>=36?'H-30':'H-7',inD=x.days-(x.days>=66?65:x.days>=36?35:10);
      out.push({sev:'blue',ico:'⏳',title:`${x.nama} masuk ${target} dalam ${inD} hari`,sub:`${x.kode} · jatuh tempo ${fmtD(x.jt)}`,href:`reminder-v2.html?kode=${x.kode}&level=${target}`});
    });
    if(A.tinggi)out.push({sev:'red',ico:'🔮',title:`${A.tinggi} toko risiko tinggi telat bayar`,sub:`Tunggakan ${A.tunggakanToko} toko · ${rp(A.tunggakanTotal)} · potensi denda ±${rp(A.dendaBulan)}/bulan`,href:'payment-compliance-v2.html#risk-ai'});
    if(!Object.keys(SLDB).length)out.push({sev:'amber',ico:'🏪',title:'Database Store Leader belum di-upload',sub:'Reminder hanya terkirim ke Admin & PIC',href:'reminder-v2.html#sldb'});
    return out;
  }
  function setBadge(){
    const n=buildNotifs().filter(x=>x.sev!=='blue'||x.ico==='🔔').length;
    const dot=BTN.notif&&BTN.notif.querySelector('.dot');
    if(!dot)return;
    if(n){dot.textContent=n>9?'9+':n;dot.classList.add('sx-count');dot.style.display='';}
    else dot.style.display='none';
  }

  // ── PANEL UI ──────────────────────────────────────────────────────────────
  const CSS=`
.sx-clickable{cursor:pointer;transition:transform .12s,box-shadow .12s}
.sx-clickable:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(30,64,175,.15)}
.sx-clickable.sx-on{outline:2px solid #2563eb;outline-offset:1px}
.icon-btn .dot.sx-count{width:auto;min-width:16px;height:16px;top:-5px;right:-5px;padding:0 4px;font-size:9.5px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center;line-height:1;border-radius:999px}
.sx-panel{position:fixed;top:64px;right:14px;width:min(400px,calc(100vw - 24px));max-height:min(560px,calc(100vh - 90px));background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 20px 50px rgba(15,23,42,.18);z-index:80;display:none;flex-direction:column;overflow:hidden;font-family:inherit}
.sx-panel.open{display:flex}
.sx-head{padding:14px 16px 10px;border-bottom:1px solid #eef1fa;display:flex;align-items:center;gap:8px}
.sx-head b{font-size:13.5px}
.sx-head small{margin-left:auto;font-size:10.5px;color:#94a3b8;font-weight:600}
.sx-body{overflow:auto;padding:8px}
.sx-input{width:100%;padding:11px 14px;border:1.5px solid #c7d2fe;border-radius:12px;font-size:13px;font-family:inherit;outline:none}
.sx-input:focus{border-color:#2563eb}
.sx-hint{font-size:11px;color:#94a3b8;padding:10px 8px}
.sx-item{display:block;padding:10px 10px;border-radius:12px;text-decoration:none;color:#0f172a}
.sx-item:hover{background:#f8fafc}
.sx-row{display:flex;gap:10px;align-items:flex-start}
.sx-ic{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.sx-red .sx-ic{background:#fee2e2}.sx-amber .sx-ic{background:#fef3c7}.sx-blue .sx-ic{background:#dbeafe}.sx-green .sx-ic{background:#dcfce7}
.sx-t{font-size:12.5px;font-weight:700;line-height:1.35}
.sx-s{font-size:11px;color:#64748b;margin-top:2px;line-height:1.45}
.sx-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
.sx-tag{font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px;background:#f1f5f9;color:#475569}
.sx-tag.t{background:#fee2e2;color:#b91c1c}.sx-tag.s{background:#fef3c7;color:#b45309}.sx-tag.r{background:#dbeafe;color:#1d4ed8}.sx-tag.a,.sx-tag.ok{background:#dcfce7;color:#15803d}
.sx-acts{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
.sx-act{font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:999px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;text-decoration:none}
.sx-act.ai{border-color:#ddd6fe;color:#6d28d9}
.sx-prof{padding:16px;display:flex;gap:12px;align-items:center;border-bottom:1px solid #eef1fa}
.sx-av{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#4f8dff,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0}
.sx-sec{font-size:10px;font-weight:800;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase;padding:10px 10px 4px}
.sx-stat{display:flex;justify-content:space-between;gap:10px;padding:7px 10px;font-size:12px}
.sx-stat span:last-child{font-weight:700;text-align:right}
.sx-ok{color:#15803d}.sx-warn{color:#b45309}.sx-bad{color:#b91c1c}
.sx-link{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;font-size:12.5px;font-weight:600;color:#0f172a;text-decoration:none}
.sx-link:hover{background:#f8fafc}
@media(max-width:600px){.sx-panel{top:58px;right:12px}}
`;
  const BTN={};let openPanel=null;
  function panel(id,title){
    let p=document.getElementById(id);
    if(p)return p;
    p=document.createElement('div');p.className='sx-panel';p.id=id;
    p.innerHTML=`<div class="sx-head"><b>${title}</b><small></small></div><div class="sx-body"></div>`;
    document.body.appendChild(p);return p;
  }
  function closeAll(){document.querySelectorAll('.sx-panel').forEach(p=>p.classList.remove('open'));Object.values(BTN).forEach(b=>b&&b.classList.remove('sx-on'));openPanel=null;}
  function toggle(p,btn,render){
    if(openPanel===p){closeAll();return;}
    closeAll();p.classList.add('open');btn.classList.add('sx-on');openPanel=p;render(p);
  }
  const loadingHTML='<div class="sx-hint">⏳ Memuat data dari Google Sheet…</div>';

  // 🔍 Cari
  function renderSearch(p){
    const body=p.querySelector('.sx-body');
    p.querySelector('small').textContent='kode · nama · kota · Store Leader';
    if(!body.querySelector('.sx-input')){
      body.innerHTML='<input class="sx-input" placeholder="Cari toko… (mis. E685, serpong, nana)" autocomplete="off"><div class="sx-res"></div>';
      body.querySelector('.sx-input').addEventListener('input',()=>doSearch(p));
    }
    setTimeout(()=>body.querySelector('.sx-input').focus(),30);
    doSearch(p);
  }
  async function doSearch(p){
    const res=p.querySelector('.sx-res'),q=p.querySelector('.sx-input').value.trim().toUpperCase();
    if(!A){res.innerHTML=loadingHTML;await ensureData();}
    if(!q){res.innerHTML=`<div class="sx-hint">Ketik minimal 2 huruf. Contoh: <b>E787</b>, <b>Tangerang Selatan</b>, <b>Ceger</b>.</div>`;return;}
    if(q.length<2)return;
    const hits=A.list.filter(x=>{const s=sl(x.kode);return x.kode.includes(q)||x.nama.toUpperCase().includes(q)||x.kota.toUpperCase().includes(q)||(s&&String(s.name).toUpperCase().includes(q));}).slice(0,12);
    if(!hits.length){res.innerHTML=`<div class="sx-hint">Tidak ada toko yang cocok dengan "${esc(q)}".</div>`;return;}
    const LV={Tinggi:'t',Sedang:'s',Rendah:'r',Aman:'a'};
    res.innerHTML=hits.map(x=>{const s=sl(x.kode);const lv=x.days!=null&&x.days>=0?lvlOf(x.days):'H-7';
      return`<div class="sx-item"><div class="sx-t">${esc(x.nama)}</div>
        <div class="sx-s">${esc(x.kode)} · ${esc(x.kota)} · SL: ${s?esc(s.name):'<span class="sx-warn">belum terdata</span>'}</div>
        <div class="sx-tags"><span class="sx-tag ${x.lunas?'ok':''}">${x.lunas?'✅ Lunas 26/27':'Belum bayar 26/27'}</span><span class="sx-tag">JT ${fmtD(x.jt)}${x.days!=null?` · ${x.days} hr`:''}</span><span class="sx-tag ${LV[x.level]}">Risiko ${x.level} (${x.score})</span>${x.tunggakan?`<span class="sx-tag t">Tunggakan ${rp(x.tunggakan)}</span>`:''}</div>
        <div class="sx-acts"><a class="sx-act ai" href="ai-agent-v2.html?q=${encodeURIComponent('Jelaskan status pajak lengkap toko '+x.kode+' per periode, tunggakan, risiko, dan Store Leader-nya')}">🤖 Tanya AI Agent</a><a class="sx-act" href="reminder-v2.html?kode=${x.kode}&level=${lv}">📲 Preview reminder</a></div></div>`;}).join('');
  }

  // 🔔 Notifikasi
  async function renderNotif(p){
    const body=p.querySelector('.sx-body');
    if(!A){body.innerHTML=loadingHTML;await ensureData();}
    const list=buildNotifs();
    p.querySelector('small').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'short'});
    body.innerHTML=list.length?list.map(n=>`<a class="sx-item sx-${n.sev}" href="${n.href}"><div class="sx-row"><div class="sx-ic">${n.ico}</div><div><div class="sx-t">${esc(n.title)}</div><div class="sx-s">${esc(n.sub)}</div></div></div></a>`).join('')
      :'<div class="sx-item sx-green"><div class="sx-row"><div class="sx-ic">✅</div><div><div class="sx-t">Tidak ada yang perlu ditindaklanjuti hari ini</div></div></div></div>';
  }

  // 👤 Profil
  async function renderProfile(p){
    p.querySelector('.sx-head').style.display='none';
    const body=p.querySelector('.sx-body');body.style.padding='0';
    let rec={};try{rec=JSON.parse(localStorage.getItem('signtaxera_recipients'))||{}}catch(e){}
    const token=(()=>{try{return localStorage.getItem('signtaxera_fonnte_token')}catch(e){return null}})();
    const ini=USER.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    const draw=(ai)=>{
      const slN=A?A.list.filter(x=>sl(x.kode)).length:null;
      body.innerHTML=`<div class="sx-prof"><div class="sx-av">${ini}</div><div><div class="sx-t" style="font-size:14px">${USER.name}</div><div class="sx-s"><b>${USER.role}</b><br>${USER.unit}</div></div></div>
      <div style="padding:6px">
        <div class="sx-sec">Status sistem</div>
        <div class="sx-stat"><span>📄 Google Sheet</span><span class="${A?'sx-ok':''}">${A?`✓ ${A.total} toko terbaca`:'memuat…'}</span></div>
        <div class="sx-stat"><span>🏪 Database Store Leader</span><span class="${slN==null?'':slN===A.total?'sx-ok':slN?'sx-warn':'sx-bad'}">${slN==null?'memuat…':`${slN}/${A.total} toko`}</span></div>
        <div class="sx-stat"><span>🤖 AI (DeepSeek)</span><span class="${ai===true?'sx-ok':ai===false?'sx-bad':''}">${ai===true?'✓ Terhubung':ai===false?'✗ Tidak terhubung':'mengecek…'}</span></div>
        <div class="sx-stat"><span>💬 WhatsApp (Fonnte)</span><span class="${token?'sx-ok':'sx-warn'}">${token?'✓ Token tersimpan':'⚠ Token belum diisi di browser ini'}</span></div>
        <div class="sx-stat"><span>👥 Admin / PIC</span><span class="${rec.admin&&rec.finance?'sx-ok':'sx-warn'}">${rec.admin?'Admin ✓':'Admin —'} · ${rec.finance?'PIC ✓':'PIC —'}</span></div>
        <div class="sx-sec">Pintasan</div>
        <a class="sx-link" href="reminder-v2.html#config">⚙️ Konfigurasi Penerima Reminder</a>
        <a class="sx-link" href="reminder-v2.html#sldb">👤 Database Store Leader</a>
        <a class="sx-link" href="payment-compliance-v2.html#risk-ai">📝 Laporan Mingguan (AI)</a>
        <a class="sx-link" href="ai-agent-v2.html">🤖 AI Agent</a>
      </div>`;
    };
    draw(null);
    ensureData().then(()=>draw(window._sxAI));
    if(window._sxAI===undefined){
      try{
        const r=await fetch(API_BASE+'/.netlify/functions/ai-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'ping'}],max_tokens:1})});
        const d=await r.json();window._sxAI=!!(r.ok&&d.content);
      }catch(e){window._sxAI=false}
    }
    await ensureData().catch(()=>{});draw(window._sxAI);
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  function init(){
    const right=document.querySelector('.tb-right');if(!right)return;
    const css=document.createElement('style');css.textContent=CSS;document.head.appendChild(css);
    const icons=right.querySelectorAll('.icon-btn');
    BTN.search=icons[0];BTN.notif=icons[1];BTN.prof=right.querySelector('.avatar');
    const map=[[BTN.search,'sx-search','🔍 Cari Toko',renderSearch,'Cari toko'],[BTN.notif,'sx-notif','🔔 Notifikasi',renderNotif,'Notifikasi'],[BTN.prof,'sx-prof','Profil',renderProfile,'Profil & status sistem']];
    map.forEach(([b,id,title,fn,label])=>{
      if(!b)return;
      b.classList.add('sx-clickable');b.setAttribute('role','button');b.setAttribute('tabindex','0');b.setAttribute('title',label);b.setAttribute('aria-label',label);
      const p=panel(id,title);
      const go=e=>{e.stopPropagation();toggle(p,b,fn);};
      b.addEventListener('click',go);
      b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go(e);}});
      p.addEventListener('click',e=>e.stopPropagation());
    });
    const dot=BTN.notif&&BTN.notif.querySelector('.dot');if(dot)dot.style.display='none';
    document.addEventListener('click',closeAll);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape')closeAll();
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&BTN.search){e.preventDefault();BTN.search.click();}
    });
    ensureData().then(setBadge).catch(err=>console.warn('[header] data',err));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.SignHeader={ensureData};
})();
