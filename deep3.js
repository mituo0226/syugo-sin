
// deep3.js - external script for deep3.html (CSP-safe)
(function(){
  const $ = (s)=>document.querySelector(s);
  function parseQS(){
    const qs = new URLSearchParams(location.search);
    return {
      api: qs.get('api') || '/api/consult',
      backup: qs.get('backup') || '',
      mode: qs.get('mode') || 'full',
      year: parseInt(qs.get('year')) || null,
      month: parseInt(qs.get('month')) || null,
      day: parseInt(qs.get('day')) || null
    };
  }
  function friendly(text, status){
    try {
      const data = JSON.parse(text);
      if (status>=200 && status<300) return (data?.message || data?.result || text);
      const isRegion = data?.code === 'region_blocked' || data?.error?.code === 'unsupported_country_region_territory';
      return isRegion
        ? 'ただいま接続経路の都合により鑑定サーバへ到達できません。\nVPN/プロキシをOFF、時間を置く、または別回線でお試しください。'
        : (data?.error || data?.message || '通信エラーが発生しました。しばらくしてからお試しください。');
    } catch { return text; }
  }
  async function callAPI(primary, backup, payload){
    let res;
    try {
      res = await fetch(primary, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } catch(e) {}
    if (!res || !res.ok) {
      let t=null, isRegion=false;
      try { if (res) { t = await res.clone().text(); const d=JSON.parse(t); isRegion = d?.code==='region_blocked' || d?.error?.code==='unsupported_country_region_territory'; } } catch{}
      if ((isRegion || !res) && backup) {
        try {
          return await fetch(backup, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        } catch(e) {}
      }
    }
    return res;
  }

  function setup(){
    const q = $('#q'), btn = $('#go'), out = $('#out'), dob = $('#dob');
    if (!btn) return;

    // bring button to top, enable it
    btn.type = 'button';
    btn.disabled = false;
    btn.style.position = 'relative';
    btn.style.zIndex = '2147483647';

    const cfg = parseQS();

    // badge
    if (dob && cfg.year && cfg.month && cfg.day) {
      dob.style.display='inline-block';
      dob.textContent = `生年月日：${cfg.year}年${cfg.month}月${cfg.day}日（把握済み）`;
    }

    async function send(ev){
      if (ev) ev.preventDefault();
      const txt = (q?.value||'').trim();
      if (!txt) { q?.focus(); return; }
      btn.disabled = true;
      if (out) out.textContent = '鑑定中…';
      const payload = { text: txt, year: cfg.year, month: cfg.month, day: cfg.day, mode: cfg.mode };
      try {
        const res = await callAPI(cfg.api, cfg.backup, payload);
        if (!res) { out.textContent = '通信に失敗しました（送信先に到達できません）。?api= に実URLを指定してください。'; return; }
        const t = await res.text();
        out.textContent = friendly(t, res.status);
      } catch(e) {
        out.textContent = '通信に失敗しました。時間を置いてお試しください。';
      } finally {
        btn.disabled = false;
      }
    }

    // bind robustly
    btn.addEventListener('click', send);
    btn.addEventListener('pointerup', (e)=>{ if (e.pointerType && e.pointerType!=='mouse') send(e); });
    btn.onclick = btn.onclick || send;

    // expose for manual trigger
    window.__deep3_send = send;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
