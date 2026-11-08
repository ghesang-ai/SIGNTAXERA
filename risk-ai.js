// SIGNTAX-ERA — AI Prediksi Toko Berisiko Telat + Laporan Kepatuhan Mingguan
// Dipakai di payment-compliance-v2.html (mode 'full') dan index.html (mode 'compact').
//
// 1) PREDIKSI: skor risiko 0–100 per toko dari rumus transparan (bisa dijelaskan ke
//    Finance/juri): riwayat tunggakan periode lalu, kedekatan jatuh tempo, besar nominal,
//    dan kelengkapan data. Status bayar 2026–2027 diambil dari kolom STATUS di Google Sheet.
// 2) AI: DeepSeek (Netlify function ai-proxy) menulis laporan mingguan untuk Area Manager
//    dari hasil skor tersebut. AI hanya menarasikan — angka dihitung oleh sistem.
(function(){
  const SHEET_CSV='https://docs.google.com/spreadsheets/d/e/2PACX-1vTlnh9gP9vvKjUtnNMaGfU_dOpMQzSfLQul0S21sbDPkWdpkkjboihcpyQ3-FnS8w/pub?gid=877556055&single=true&output=csv';
  const AI_ENDPOINT=(/netlify\.app$/.test(location.hostname)?'':'https://signtax-era.netlify.app')+'/.netlify/functions/ai-proxy';
  const REPORT_CACHE_KEY='signtaxera_ai_weekly_report';
  const DENDA_RATE=0.01; // 1%/bulan — UU HKPD No. 1/2022

  // ── DATA ──────────────────────────────────────────────────────────────────
  function parseCSV(text){
    const rows=[];
    text.split('\n').forEach(l=>{
      const line=l.trim();if(!line)return;
      const cols=[];let cur='',inQ=false;
      for(let j=0;j<line.length;j++){
        const ch=line[j];
        if(ch==='"'){if(inQ&&line[j+1]==='"'){cur+='"';j++;}else inQ=!inQ;}
        else if(ch===','&&!inQ){cols.push(cur);cur='';}
        else cur+=ch;
      }
      cols.push(cur);rows.push(cols);
    });
    return rows;
  }
  const isLunasCell=v=>(v||'').toUpperCase().includes('LUNAS');
  function num(v){
    if(!v||isLunasCell(v))return 0;
    const n=parseFloat(String(v).replace(/,/g,''));
    return isNaN(n)?0:n;
  }
  function parseJT(v){
    if(!v)return'';v=v.trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    const md=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(md)return`${md[3]}-${md[1]}-${md[2]}`;
    const M={Jan:'01',Feb:'02',Mar:'03',Apr:'04',Mei:'05',May:'05',Jun:'06',Jul:'07',Ags:'08',Aug:'08',Sep:'09',Okt:'10',Oct:'10',Nov:'11',Des:'12',Dec:'12'};
    const dm=v.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
    if(dm){const mo=M[dm[2]]||M[dm[2].slice(0,3)];if(mo)return`${dm[3]}-${mo}-${dm[1].padStart(2,'0')}`;}
    return'';
  }
  function daysTill(d){
    const t=new Date();t.setHours(0,0,0,0);
    return Math.round((new Date(d)-t)/86400000);
  }
  async function loadStores(){
    const resp=await fetch(SHEET_CSV+'&t='+Date.now());
    const rows=parseCSV(await resp.text()).slice(3).filter(r=>r[0]&&r[0].trim()&&!isNaN(r[0].trim()));
    const seen=new Set();const out=[];
    rows.forEach(r=>{
      const kode=(r[1]||'').trim();
      if(kode){if(seen.has(kode))return;seen.add(kode);}
      const sum2627=num(r[15])+num(r[16])+num(r[17]);
      const has2627Lunas=[r[15],r[16],r[17]].some(isLunasCell);
      out.push({
        kode,nama:(r[2]||'').trim(),kota:(r[3]||'').trim(),vendor:(r[4]||'').trim(),
        jt:parseJT(r[20]),
        tagihan:sum2627>0?sum2627:(has2627Lunas?0:num(r[18])),
        t2425:num(r[5])+num(r[6])+num(r[7]),
        t2526:num(r[10])+num(r[11])+num(r[12]),
        lunas:isLunasCell(r[22]),
      });
    });
    return out;
  }

  // ── PREDIKSI RISIKO (rumus transparan) ────────────────────────────────────
  function scoreStore(s){
    const reasons=[];let score=0;
    const tunggakan=s.t2425+s.t2526;
    if(s.t2425>0){score+=20;reasons.push('Tagihan 2024–2025 belum lunas');}
    if(s.t2526>0){score+=20;reasons.push('Tagihan 2025–2026 belum lunas');}
    const days=s.jt?daysTill(s.jt):null;
    if(!s.lunas){
      if(days==null){score+=10;reasons.push('Jatuh tempo belum tercatat');}
      else if(days<0){score+=45;reasons.push(`Lewat jatuh tempo ${-days} hari`);}
      else if(days<=7){score+=35;reasons.push(`Jatuh tempo ${days} hari lagi`);}
      else if(days<=30){score+=25;reasons.push(`Jatuh tempo ${days} hari lagi`);}
      else if(days<=60){score+=15;reasons.push(`Masuk window H-60 (${days} hari)`);}
      else if(days<=90){score+=8;reasons.push(`Jatuh tempo ${days} hari lagi`);}
      const exposure=s.tagihan+tunggakan;
      if(exposure>=50e6){score+=10;reasons.push('Nominal besar (≥ Rp50jt) — approval CA lebih lama');}
      else if(exposure>=20e6){score+=5;reasons.push('Nominal menengah (≥ Rp20jt)');}
    }
    score=Math.min(100,score);
    const level=score>=50?'Tinggi':score>=25?'Sedang':score>0?'Rendah':'Aman';
    const overdueBase=tunggakan+((days!=null&&days<0&&!s.lunas)?s.tagihan:0);
    return{...s,days,tunggakan,score,level,reasons,dendaBulan:overdueBase*DENDA_RATE};
  }
  function analyze(stores){
    const list=stores.map(scoreStore).sort((a,b)=>b.score-a.score||(a.days??1e9)-(b.days??1e9));
    const count=l=>list.filter(x=>x.level===l).length;
    return{
      list,total:list.length,
      lunas:list.filter(x=>x.lunas).length,
      tinggi:count('Tinggi'),sedang:count('Sedang'),rendah:count('Rendah'),aman:count('Aman'),
      tunggakanToko:list.filter(x=>x.tunggakan>0).length,
      tunggakanTotal:list.reduce((a,x)=>a+x.tunggakan,0),
      dendaBulan:list.reduce((a,x)=>a+x.dendaBulan,0),
      dueWindow:list.filter(x=>!x.lunas&&x.days!=null&&x.days>=0&&x.days<=60).length,
    };
  }

  // ── FORMAT ────────────────────────────────────────────────────────────────
  function rp(n){
    if(!n)return'Rp 0';
    if(n>=1e9)return'Rp '+(n/1e9).toFixed(2)+' M';
    if(n>=1e6)return'Rp '+(n/1e6).toFixed(1)+' jt';
    return'Rp '+Math.round(n).toLocaleString('id-ID');
  }
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const today=()=>new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // ── LAPORAN MINGGUAN (AI) ─────────────────────────────────────────────────
  const REPORT_SYSTEM=`Kamu adalah analis kepatuhan pajak reklame SIGNTAX-ERA untuk toko Erafone Region 5 (Jakarta, Tangerang, Banten), Erajaya.
Tulis LAPORAN KEPATUHAN MINGGUAN untuk Area Manager berdasarkan DATA yang diberikan.

Aturan:
- Bahasa Indonesia profesional, ringkas, siap dikirim via WhatsApp (pakai *tebal* dan bullet "• "). Maksimal ±250 kata.
- Gunakan HANYA angka & nama toko dari DATA. Jangan mengarang angka, tanggal, atau toko lain.
- Skor risiko adalah PREDIKSI kemungkinan toko telat bayar; jelaskan alasannya singkat per toko.
- Struktur persis:
  *Ringkasan Minggu Ini* (2–3 bullet)
  *Prediksi Toko Berisiko Telat* (maks 5 toko, format: Nama (kode) — alasan utama)
  *Rekomendasi Aksi Minggu Ini* (3–4 bullet konkret: Cash Advance di H-60, pelunasan tunggakan, eskalasi H-7 ke Area Manager/TSH, pembayaran langsung ke Bapenda tanpa vendor)
- Langsung mulai dari "*Ringkasan Minggu Ini*": tanpa judul laporan, tanpa tanggal, tanpa salam, tanpa tanda tangan (sistem menambahkannya).`;

  function reportFacts(a){
    const top=a.list.filter(x=>x.level==='Tinggi'||x.level==='Sedang').slice(0,8);
    return[
      `Tanggal: ${today()}`,
      `Total toko: ${a.total}`,
      `Status LUNAS 2026–2027: ${a.lunas} toko (${a.total?Math.round(a.lunas/a.total*100):0}%)`,
      `Prediksi risiko: Tinggi ${a.tinggi}, Sedang ${a.sedang}, Rendah ${a.rendah}, Aman ${a.aman}`,
      `Toko dengan tunggakan periode lalu: ${a.tunggakanToko} toko, total ${rp(a.tunggakanTotal)}`,
      `Estimasi potensi denda: ${rp(a.dendaBulan)} per bulan (1%/bulan)`,
      `Toko belum lunas yang jatuh tempo ≤60 hari: ${a.dueWindow}`,
      `Daftar toko risiko tertinggi:`,
      ...top.map(x=>`- ${x.nama} (${x.kode}), ${x.kota}: skor ${x.score} (${x.level}); ${x.reasons.join('; ')||'-'}; tagihan berjalan ${rp(x.tagihan)}; tunggakan ${rp(x.tunggakan)}`),
    ].join('\n');
  }
  function templateReport(a){
    const top=a.list.filter(x=>x.level==='Tinggi'||x.level==='Sedang').slice(0,5);
    return`*Ringkasan Minggu Ini*
• ${a.lunas}/${a.total} toko LUNAS periode 2026–2027 (${a.total?Math.round(a.lunas/a.total*100):0}%).
• ${a.tunggakanToko} toko masih punya tunggakan periode lalu, total ${rp(a.tunggakanTotal)} (potensi denda ±${rp(a.dendaBulan)}/bulan).
• ${a.dueWindow} toko belum lunas masuk window jatuh tempo ≤60 hari.

*Prediksi Toko Berisiko Telat*
${top.map(x=>`• ${x.nama} (${x.kode}) — ${x.reasons[0]||'-'}`).join('\n')||'• Tidak ada toko berisiko tinggi/sedang.'}

*Rekomendasi Aksi Minggu Ini*
• Ajukan Cash Advance untuk toko yang masuk H-60.
• Prioritaskan pelunasan tunggakan periode lalu untuk menekan denda 1%/bulan.
• Eskalasi toko H-7 ke Area Manager/TSH.
• Bayar langsung ke Bapenda sesuai SOP SIGNTAX-ERA.`;
  }
  async function generateReport(a,{force=false}={}){
    const key=new Date().toISOString().slice(0,10)+'|'+a.lunas+'|'+a.tinggi+'|'+a.sedang+'|'+Math.round(a.tunggakanTotal);
    if(!force){
      try{const c=JSON.parse(localStorage.getItem(REPORT_CACHE_KEY));if(c&&c.key===key)return{text:c.text,source:'AI',cached:true};}catch(e){}
    }
    try{
      const ctrl=new AbortController();const to=setTimeout(()=>ctrl.abort(),30000);
      const res=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,
        body:JSON.stringify({system:REPORT_SYSTEM,max_tokens:900,messages:[{role:'user',content:'DATA:\n'+reportFacts(a)+'\n\nTulis laporannya sekarang.'}]})});
      clearTimeout(to);
      const data=await res.json();
      const text=((data.content&&data.content[0]&&data.content[0].text)||'').trim();
      if(!res.ok||text.length<80)throw new Error(data.error||'Jawaban AI kosong');
      try{localStorage.setItem(REPORT_CACHE_KEY,JSON.stringify({key,text}));}catch(e){}
      return{text,source:'AI'};
    }catch(e){
      return{text:templateReport(a),source:'TEMPLATE',error:e.name==='AbortError'?'AI timeout':e.message};
    }
  }
  const header=()=>`*[SIGNTAX-ERA] 📊 Laporan Kepatuhan Pajak Reklame — Region 5*\n_${today()}_\n\n`;
  const footer=src=>`\n\n_SIGNTAX-ERA | ${src==='AI'?'✨ Disusun oleh AI dari data Google Sheet':'Ringkasan otomatis dari data Google Sheet'}_`;

  // ── UI ────────────────────────────────────────────────────────────────────
  const CSS=`
.rk-chips{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.rk-chip{border-radius:14px;padding:10px 12px;cursor:pointer;border:2px solid transparent;transition:.15s}
.rk-chip.on{border-color:currentColor}
.rk-chip .n{font-size:20px;font-weight:800;line-height:1.1}
.rk-chip .l{font-size:10.5px;font-weight:700;opacity:.85}
.rk-t{background:#fee2e2;color:#b91c1c}.rk-s{background:#fef3c7;color:#b45309}.rk-r{background:#dbeafe;color:#1d4ed8}.rk-a{background:#dcfce7;color:#15803d}
.rk-meta{font-size:11.5px;color:#64748b;margin-bottom:10px;line-height:1.6}
.rk-meta b{color:#0f172a}
.rk-row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #eef1fa}
.rk-score{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0}
.rk-info{flex:1;min-width:0}
.rk-name{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-sub{font-size:10.5px;color:#94a3b8;font-weight:600;margin:1px 0 4px}
.rk-reasons{display:flex;flex-wrap:wrap;gap:4px}
.rk-reasons span{font-size:10px;background:#f1f5f9;color:#475569;border-radius:999px;padding:2px 8px;font-weight:600}
.rk-right{text-align:right;flex-shrink:0;font-size:11px;font-weight:700;color:#0f172a}
.rk-right small{display:block;font-size:10px;color:#94a3b8;font-weight:600}
.rk-more{display:block;width:100%;margin-top:10px;background:#f1f5f9;border:none;border-radius:12px;padding:9px;font-size:11.5px;font-weight:700;color:#475569;cursor:pointer}
.rk-btn{background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:none;padding:9px 14px;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;box-shadow:0 6px 14px rgba(124,58,237,.25);white-space:nowrap}
.rk-btn:disabled{opacity:.55}
.rk-btn2{background:#fff;border:1px solid #e2e8f0;color:#0f172a;padding:8px 12px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer}
.rk-report{margin-top:14px;display:none}
.rk-report.show{display:block}
.rk-report-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.rk-src{font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:999px;background:#ede9fe;color:#6d28d9}
.rk-src.tpl{background:#fef3c7;color:#b45309}
.rk-report-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;font-size:12px;line-height:1.65;white-space:pre-wrap;color:#1e293b}
.rk-report-box.loading{opacity:.55}
.rk-note{font-size:10.5px;color:#94a3b8;margin-top:8px;line-height:1.5}
.rk-actions{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
@media(max-width:600px){.rk-chips{grid-template-columns:repeat(2,1fr)}}
@media print{body *{visibility:hidden}.rk-report-box,.rk-report-box *{visibility:visible}.rk-report-box{position:absolute;left:0;top:0;width:100%;border:none}}
`;
  function injectCSS(){
    if(document.getElementById('rk-css'))return;
    const s=document.createElement('style');s.id='rk-css';s.textContent=CSS;document.head.appendChild(s);
  }
  const LV={Tinggi:'rk-t',Sedang:'rk-s',Rendah:'rk-r',Aman:'rk-a'};
  function rowHTML(x){
    const due=x.days==null?'—':x.days<0?`Lewat ${-x.days} hr`:`${x.days} hr lagi`;
    return`<div class="rk-row">
      <div class="rk-score ${LV[x.level]}" title="Skor risiko ${x.score}/100">${x.score}</div>
      <div class="rk-info">
        <div class="rk-name">${esc(x.nama)}</div>
        <div class="rk-sub">${esc(x.kode)} · ${esc(x.kota)} · ${x.lunas?'✅ Lunas 26/27':'Belum bayar 26/27'}</div>
        <div class="rk-reasons">${(x.reasons.length?x.reasons:['Tidak ada faktor risiko']).map(r=>`<span>${esc(r)}</span>`).join('')}</div>
      </div>
      <div class="rk-right">${rp(x.tagihan+x.tunggakan)}<small>${due}</small></div>
    </div>`;
  }

  async function mount(el,{mode='full'}={}){
    injectCSS();
    el.innerHTML='<div class="rk-meta">⏳ Menghitung prediksi risiko dari Google Sheet…</div>';
    let a;
    try{a=analyze(await loadStores());}
    catch(e){el.innerHTML=`<div class="rk-meta" style="color:#dc2626">Gagal memuat data: ${esc(e.message)}</div>`;return;}
    window.SIGNTAX_RISK=a;

    if(mode==='compact'){
      const top=a.list.filter(x=>x.level!=='Aman').slice(0,5);
      el.innerHTML=`
        <div class="rk-chips">
          <div class="rk-chip rk-t"><div class="n">${a.tinggi}</div><div class="l">Risiko Tinggi</div></div>
          <div class="rk-chip rk-s"><div class="n">${a.sedang}</div><div class="l">Sedang</div></div>
          <div class="rk-chip rk-r"><div class="n">${a.rendah}</div><div class="l">Rendah</div></div>
          <div class="rk-chip rk-a"><div class="n">${a.aman}</div><div class="l">Aman</div></div>
        </div>
        <div class="rk-meta">Potensi denda dari tunggakan: <b>±${rp(a.dendaBulan)}/bulan</b> · ${a.tunggakanToko} toko masih punya tunggakan periode lalu.</div>
        ${top.map(rowHTML).join('')||'<div class="rk-meta">✅ Tidak ada toko berisiko.</div>'}
        <a href="payment-compliance-v2.html#risk-ai" class="rk-more" style="text-align:center;text-decoration:none">Lihat semua &amp; buat laporan AI mingguan ›</a>`;
      return a;
    }

    let filter='',showAll=false;
    el.innerHTML=`
      <div class="rk-chips">
        <div class="rk-chip rk-t" data-f="Tinggi"><div class="n">${a.tinggi}</div><div class="l">Risiko Tinggi</div></div>
        <div class="rk-chip rk-s" data-f="Sedang"><div class="n">${a.sedang}</div><div class="l">Risiko Sedang</div></div>
        <div class="rk-chip rk-r" data-f="Rendah"><div class="n">${a.rendah}</div><div class="l">Risiko Rendah</div></div>
        <div class="rk-chip rk-a" data-f="Aman"><div class="n">${a.aman}</div><div class="l">Aman</div></div>
      </div>
      <div class="rk-meta">
        Lunas 2026–2027: <b>${a.lunas}/${a.total} toko</b> ·
        Tunggakan periode lalu: <b>${a.tunggakanToko} toko (${rp(a.tunggakanTotal)})</b> ·
        Potensi denda: <b>±${rp(a.dendaBulan)}/bulan</b>
      </div>
      <div class="rk-list"></div>
      <button class="rk-more" type="button"></button>
      <div class="rk-report">
        <div class="rk-report-head">
          <strong style="font-size:13px">📝 Laporan Kepatuhan Mingguan</strong>
          <span class="rk-src">—</span>
          <div class="rk-actions">
            <button class="rk-btn2" data-act="copy">📋 Salin</button>
            <button class="rk-btn2" data-act="wa">💬 Kirim WA</button>
            <button class="rk-btn2" data-act="print">🖨️ Cetak</button>
            <button class="rk-btn2" data-act="regen">🔄 Generate ulang</button>
          </div>
        </div>
        <div class="rk-report-box"></div>
        <div class="rk-note"></div>
      </div>
      <div class="rk-note">Cara hitung skor (0–100): tunggakan 2024–25 (+20) & 2025–26 (+20); jatuh tempo — lewat (+45), ≤7 hr (+35), ≤30 hr (+25), ≤60 hr (+15), ≤90 hr (+8); nominal ≥Rp50jt (+10) / ≥Rp20jt (+5); jatuh tempo kosong (+10). Tinggi ≥50 · Sedang 25–49 · Rendah 1–24. Potensi denda = 1%/bulan × tunggakan (UU HKPD No. 1/2022).</div>`;

    const listEl=el.querySelector('.rk-list'),moreBtn=el.querySelector('.rk-more');
    function renderList(){
      const items=filter?a.list.filter(x=>x.level===filter):a.list.filter(x=>x.level!=='Aman');
      const shown=showAll?items:items.slice(0,8);
      listEl.innerHTML=shown.map(rowHTML).join('')||'<div class="rk-meta">Tidak ada toko pada kategori ini.</div>';
      moreBtn.style.display=items.length>8?'block':'none';
      moreBtn.textContent=showAll?'Tampilkan lebih sedikit':`Tampilkan semua (${items.length})`;
      el.querySelectorAll('.rk-chip').forEach(c=>c.classList.toggle('on',c.dataset.f===filter));
    }
    el.querySelectorAll('.rk-chip').forEach(c=>c.onclick=()=>{filter=filter===c.dataset.f?'':c.dataset.f;showAll=false;renderList();});
    moreBtn.onclick=()=>{showAll=!showAll;renderList();};
    renderList();

    // Laporan AI
    const rep=el.querySelector('.rk-report'),box=el.querySelector('.rk-report-box'),
      src=el.querySelector('.rk-src'),note=rep.querySelector('.rk-note');
    let current='';
    async function run(force){
      rep.classList.add('show');box.classList.add('loading');
      src.textContent='⏳ AI menyusun…';src.className='rk-src';
      if(!current)box.textContent='Menganalisis data & menulis laporan…';
      const btns=document.querySelectorAll('[data-rk-report],.rk-btn2[data-act="regen"]');btns.forEach(b=>b.disabled=true);
      const r=await generateReport(a,{force});
      btns.forEach(b=>b.disabled=false);box.classList.remove('loading');
      current=header()+r.text+footer(r.source);
      box.textContent=current;
      src.textContent=r.source==='AI'?(r.cached?'✨ AI (cache hari ini)':'✨ Disusun AI'):'📄 Template';
      src.className='rk-src'+(r.source==='AI'?'':' tpl');
      note.textContent=r.source==='AI'
        ?'AI menarasikan hasil skor; seluruh angka dihitung sistem dari Google Sheet. Periksa sebelum dikirim.'
        :`AI tidak tersedia (${r.error}) — memakai ringkasan otomatis.`;
      rep.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    rep.querySelector('[data-act="regen"]').onclick=()=>run(true);
    rep.querySelector('[data-act="copy"]').onclick=async()=>{
      try{await navigator.clipboard.writeText(current);toast('📋 Laporan disalin');}catch(e){toast('Gagal menyalin');}
    };
    rep.querySelector('[data-act="wa"]').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(current),'_blank');
    rep.querySelector('[data-act="print"]').onclick=()=>window.print();
    el._runReport=run;
    return a;
  }
  function toast(msg){
    const t=document.getElementById('toast');
    if(!t){alert(msg);return;}
    t.textContent=msg;t.classList.add('show');
    clearTimeout(window._rkToast);window._rkToast=setTimeout(()=>t.classList.remove('show'),2800);
  }

  window.SignRisk={mount,analyze,scoreStore,loadStores,generateReport};
})();
