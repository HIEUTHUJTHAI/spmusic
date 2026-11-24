// Keep DOM order stable until drop so playback controls and keyboard focus survive a drag.
export function startPlaylistDrag(event, commit) {
  if (!event.isPrimary || event.button !== 0) return;
  const grip = event.currentTarget, row = grip.closest('[data-song]'), table = row.parentElement;
  if (table.dataset.sorting) return;
  event.preventDefault();
  const rows = [...table.querySelectorAll(':scope > [data-song]')];
  const origin = rows.indexOf(row), top = table.getBoundingClientRect().top;
  const slots = rows.map(el => {
    const r = el.getBoundingClientRect();
    return {y:r.top-top,h:r.height};
  });
  const start = event.clientY, slot = slots[origin];
  let y = start, target = origin, frame;
  const scroll = (() => {
    for(let el=table.parentElement;el;el=el.parentElement)
      if (el.scrollHeight>el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
    return document.scrollingElement;
  })();
  function position() {
    const dy = Math.max(slots[0].y-slot.y, Math.min(slots.at(-1).y-slot.y,y-start+top-table.getBoundingClientRect().top));
    const center = slot.y+slot.h/2+dy;
    target = origin;
    slots.forEach((s,i)=>{
      if(i<origin && center<s.y+s.h/2) target=Math.min(target,i);
      if(i>origin && center>s.y+s.h/2) target=i;
    });
    rows.forEach((el,i)=>{
      const offset=i===origin?dy:i>=target&&i<origin?slot.h:i<=target&&i>origin?-slot.h:0;
      el.style.translate='0 '+offset+'px';
    });
  }
  function tick() {
    if (!table.isConnected) { finish(false); return; }
    const bounds=scroll===document.scrollingElement?{top:0,bottom:innerHeight}:scroll.getBoundingClientRect();
    if(y<bounds.top+40) scroll.scrollTop-=10;
    else if(y>bounds.bottom-40) scroll.scrollTop+=10;
    position(); frame=requestAnimationFrame(tick);
  }
  const listeners=new AbortController(), opts={signal:listeners.signal};
  function finish(save) {
    cancelAnimationFrame(frame);
    listeners.abort();
    if(grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
    const before= row.getBoundingClientRect().top;
    delete table.dataset.sorting;
    row.classList.remove('held-song');
    rows.forEach(el=>el.style.removeProperty('translate'));
    if(save && target!==origin) commit(row.dataset.song,rows[target].dataset.song);
    requestAnimationFrame(()=>{
      if(!row.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const delta=before-row.getBoundingClientRect().top;
      row.animate([{translate:'0 '+delta+'px',scale:'1.012'},{translate:'0 0',scale:'1'}],
        {duration:260,easing:'cubic-bezier(.2,1.35,.35,1)'});
    });
  }
  table.dataset.sorting='true'; row.classList.add('held-song');
  grip.setPointerCapture(event.pointerId);
  grip.addEventListener('pointermove',e=>{if(e.pointerId===event.pointerId)y=e.clientY},opts);
  grip.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId){y=e.clientY;position();finish(true)}},opts);
  grip.addEventListener('lostpointercapture',()=>finish(false),opts);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')finish(false)},opts);
  frame=requestAnimationFrame(tick);
}
