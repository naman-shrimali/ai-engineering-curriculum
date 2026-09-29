/* Interactive curriculum map: every chapter as a node, prerequisites as edges.
   Two layouts — by module (swimlanes) and by prerequisite depth. */
import * as d3 from 'd3';
import { $, $$, esc, h, ico, fmtMins, modVar, toast } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { CONTENT, go } from '../main.js';

const NW = 168, NH = 48, GAP = 12, LANE = 206, TOP = 44, PAD = 30;

function layout(mode) {
  const nodes = G.all().map(c => ({ ...c }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  let lanes;
  if (mode === 'depth') {
    const maxD = Math.max(...nodes.map(n => G.depth(n.id)));
    lanes = Array.from({ length: maxD + 1 }, (_, i) => ({ key: 'd' + i, label: i === 0 ? 'Start here' : `Level ${i}`, color: 'var(--fg-3)', ids: [] }));
    const order = new Map(CONTENT.modules.map((m, i) => [m.key, i]));
    for (const n of nodes.sort((a, b) => (order.get(a.module) - order.get(b.module)) || a.id.localeCompare(b.id))) lanes[G.depth(n.id)].ids.push(n.id);
  } else {
    lanes = CONTENT.modules.map(m => ({ key: m.key, label: (m.n < 10 ? m.n + ' · ' : '') + m.short, color: modVar(m.key), ids: m.chapters.filter(id => byId.has(id)) }));
  }
  lanes.forEach((l, li) => l.ids.forEach((id, i) => { const n = byId.get(id); n.x = PAD + li * LANE; n.y = TOP + i * (NH + GAP); n.lane = li; }));
  const W = PAD * 2 + lanes.length * LANE, H = TOP + Math.max(...lanes.map(l => l.ids.length)) * (NH + GAP) + PAD;
  const edges = [];
  for (const n of nodes) for (const p of n.prereqs) { const s = byId.get(p); if (s) edges.push({ s, t: n, id: p + '>' + n.id }); }
  return { nodes, byId, lanes, edges, W, H };
}

function edgePath(e) {
  const sx = e.s.x + NW, sy = e.s.y + NH / 2, tx = e.t.x, ty = e.t.y + NH / 2;
  if (e.s.lane === e.t.lane) { const bx = sx + 46; return `M${sx},${sy} C${bx},${sy} ${bx},${ty} ${sx},${ty}`; }
  if (e.t.lane < e.s.lane) { // backward edge: leave from the left, enter from the right
    const lx = e.s.x, rx = e.t.x + NW; const dx = Math.max(50, (lx - rx) / 2);
    return `M${lx},${sy} C${lx - dx},${sy} ${rx + dx},${ty} ${rx},${ty}`;
  }
  const dx = Math.max(40, (tx - sx) / 2);
  return `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`;
}

async function map(el, params, query) {
  let mode = 'modules', focus = null;
  el.innerHTML = h`<div class="mapwrap" id="mapwrap">
    <div class="map-ui"><div class="head"><h1>Curriculum map</h1><p class="sub">Every chapter and what it needs first. Hover to trace a chain, click for detail. Completed chapters unlock what depends on them.</p></div>
      <div class="row"><div class="seg" id="mode"><button type="button" data-m="modules" class="on">By module</button><button type="button" data-m="depth">By depth</button></div>
      <div class="legend"><span><i class="done"></i>done</span><span><i class="reading"></i>in progress</span><span><i class="avail"></i>available</span><span><i class="locked"></i>needs prerequisites</span></div></div></div>
    <div class="map-ctrl"><button type="button" id="z-in" title="Zoom in">+</button><button type="button" id="z-out" title="Zoom out">−</button><button type="button" id="z-fit" title="Fit">⤢</button></div>
    <div class="map-side" id="mside"></div>
    <svg id="mapsvg" role="img" aria-label="Curriculum prerequisite map"></svg></div>`;
  const svg = d3.select('#mapsvg'); const wrap = $('#mapwrap', el);
  svg.append('defs').html(`<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--fg-3)"/></marker><marker id="arr-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/></marker>`);
  const g = svg.append('g');
  const zoom = d3.zoom().scaleExtent([.25, 2.5]).on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoom).on('dblclick.zoom', null);
  let L;

  function fit() {
    const W = wrap.clientWidth, H = wrap.clientHeight, phone = W < 820;
    const uiTop = phone ? 120 : 200;                       // overlay UI height
    // fit to height (never below a readable scale); the user pans sideways
    const k = Math.max(phone ? .55 : .72, Math.min(1, (H - uiTop - 24) / L.H, (W - 40) / L.W));
    const x = L.W * k <= W - 40 ? (W - L.W * k) / 2 : 20;
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity.translate(x, uiTop).scale(k));
  }
  function draw() {
    L = layout(mode); g.selectAll('*').remove();
    const lane = g.append('g').selectAll('g').data(L.lanes).join('g').attr('class', 'maplane').style('--mc', d => d.color);
    lane.append('rect').attr('x', (d, i) => PAD + i * LANE - 14).attr('y', TOP - 40).attr('width', NW + 28).attr('height', d => d.ids.length * (NH + GAP) + 44);
    lane.append('text').attr('x', (d, i) => PAD + i * LANE).attr('y', TOP - 18).text(d => d.label);
    const edges = g.append('g').selectAll('path').data(L.edges).join('path').attr('class', 'mapedge').attr('d', edgePath).attr('marker-end', 'url(#arr)');
    const node = g.append('g').selectAll('g').data(L.nodes).join('g').attr('class', d => 'mapnode ' + G.nodeState(d.id)).style('--mc', d => modVar(d.module))
      .attr('transform', d => `translate(${d.x},${d.y})`).attr('tabindex', 0).attr('role', 'button');
    node.append('rect').attr('width', NW).attr('height', NH);
    node.append('text').attr('class', 'cid').attr('x', 10).attr('y', 17).text(d => d.id);
    node.append('text').attr('class', 'mins').attr('x', NW - 10).attr('y', 17).attr('text-anchor', 'end').text(d => G.nodeState(d.id) === 'done' ? '✓' : fmtMins(d.est_minutes));
    node.append('text').attr('x', 10).attr('y', 36).text(d => d.title.length > 26 ? d.title.slice(0, 25) + '…' : d.title);
    node.append('title').text(d => `${d.id} — ${d.title}`);
    const hl = (id, sticky) => {
      if (!id) { node.classed('dimmed', false).classed('hl', false).classed('focus', false); edges.classed('dimmed', false).classed('hl', false).attr('marker-end', 'url(#arr)'); return; }
      const up = G.ancestors(id), down = G.descendants(id); const set = new Set([id, ...up, ...down]);
      node.classed('dimmed', d => !set.has(d.id)).classed('hl', d => set.has(d.id) && d.id !== id).classed('focus', d => d.id === id);
      edges.classed('dimmed', e => !(set.has(e.s.id) && set.has(e.t.id))).classed('hl', e => set.has(e.s.id) && set.has(e.t.id))
        .attr('marker-end', e => set.has(e.s.id) && set.has(e.t.id) ? 'url(#arr-hl)' : 'url(#arr)');
      if (sticky) focus = id;
    };
    node.on('mouseenter', (e, d) => { if (!focus) hl(d.id); }).on('mouseleave', () => { if (!focus) hl(null); })
      .on('click', (e, d) => { e.stopPropagation(); if (focus === d.id) { focus = null; hl(null); side(null); } else { focus = d.id; hl(d.id, true); side(d); } })
      .on('keydown', (e, d) => { if (e.key === 'Enter') go('#/c/' + d.id); });
    svg.on('click', () => { focus = null; hl(null); side(null); });
    if (focus) { hl(focus, true); }
    if (query.c && L.byId.has(query.c) && !focus) { focus = query.c; hl(focus, true); side(L.byId.get(query.c)); }
  }
  function side(d) {
    const box = $('#mside', el); if (!d) { box.classList.remove('on'); return; }
    const st = G.nodeState(d.id); const m = G.module(d.module);
    box.classList.add('on'); box.style.setProperty('--mc', modVar(d.module));
    box.innerHTML = h`<button class="close" type="button">×</button><span class="cid">${d.id}</span><h3>${esc(d.title)}</h3>
      <div class="kv"><span class="chip mod" style="--mc:${modVar(d.module)}"><span class="dot"></span>${esc(m?.short || d.module)}</span><span class="chip ${st}">${st === 'available' ? 'ready to start' : st === 'locked' ? 'needs prerequisites' : st === 'reading' ? 'in progress' : 'done'}</span>${d.est_minutes ? `<span class="chip">${fmtMins(d.est_minutes)}</span>` : ''}${d.difficulty ? `<span class="chip">difficulty ${d.difficulty}/5</span>` : ''}</div>
      <p>${esc(d.objective || d.summary || '')}</p>
      ${d.prereqs.length ? `<p><b style="color:var(--fg)">Needs first</b><br>${d.prereqs.map(p => `<a href="#/map?c=${p}" data-focus="${p}" class="${store.isDone(p) ? 'done' : ''}" style="font-family:var(--mono);font-size:12px;margin-right:8px;color:${store.isDone(p) ? 'var(--ok)' : 'var(--fg-2)'}">${p}${store.isDone(p) ? ' ✓' : ''}</a>`).join('')}</p>` : ''}
      ${d.dependents?.length ? `<p><b style="color:var(--fg)">Unlocks</b><br>${d.dependents.map(p => `<a href="#/map?c=${p}" data-focus="${p}" style="font-family:var(--mono);font-size:12px;margin-right:8px;color:var(--fg-2)">${p}</a>`).join('')}</p>` : ''}
      <div class="row" style="margin-top:14px"><a class="btn primary sm" href="#/c/${d.id}">Open chapter</a><button class="btn sm" id="side-done" type="button">${st === 'done' ? 'Mark not done' : 'Mark done'}</button></div>`;
    box.querySelector('.close').onclick = () => { focus = null; draw(); side(null); };
    box.querySelector('#side-done').onclick = () => { store.setDone(d.id, st !== 'done'); draw(); side(L.byId.get(d.id)); };
    $$('[data-focus]', box).forEach(a => a.onclick = e => { e.preventDefault(); focus = a.dataset.focus; draw(); side(L.byId.get(focus)); });
  }
  draw(); requestAnimationFrame(fit);
  $$('#mode button', el).forEach(b => b.onclick = () => { mode = b.dataset.m; $$('#mode button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); fit(); });
  $('#z-in', el).onclick = () => svg.transition().call(zoom.scaleBy, 1.3);
  $('#z-out', el).onclick = () => svg.transition().call(zoom.scaleBy, .75);
  $('#z-fit', el).onclick = fit;
  const unsub = store.subscribe(() => draw());
  const ro = new ResizeObserver(() => { /* keep transform; user can refit */ }); ro.observe(wrap);
  return () => { unsub(); ro.disconnect(); };
}
export default { map };
