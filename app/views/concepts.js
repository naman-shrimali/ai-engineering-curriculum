/* Concept knowledge graph: how ideas underwrite each other across modules.
   Parsed from tutor/knowledge-graph.md — the diagram source of truth. */
import * as d3 from 'd3';
import { $, $$, esc, h, modVar, fmtMins } from '../lib/ui.js';
import * as store from '../lib/store.js';
import * as G from '../lib/graph.js';
import { CONTENT, go } from '../main.js';
import { assess, LEVEL_INFO } from '../lib/mastery.js';
import { labsByChapter } from '../lib/labrun.js';

async function concepts(el, params, query) {
  const K = CONTENT.concepts; let group = 'all', lens = query?.lens === 'mastery' ? 'mastery' : 'module';
  const labs = await labsByChapter();
  const LV = new Map(CONTENT.chapters.map(c => [c.id, assess(c, store.state, labs[c.id])]));
  const MODULE_LEGEND = CONTENT.modules.filter(m => m.n < 10).map(m => `<span><i style="border-color:${modVar(m.key)};background:${modVar(m.key)}"></i>${esc(m.short)}</span>`).join('');
  const MASTERY_LEGEND = `${['strong', 'solid', 'shaky', 'weak', 'early', 'read', 'none'].map(k => `<span><i class="lv lv-${k}"></i>${LEVEL_INFO[k].label.toLowerCase()}</span>`).join('')}`;
  el.innerHTML = h`<div class="mapwrap" id="cwrap">
    <div class="map-ui"><div class="head"><h1>Concept graph</h1><p class="sub">Which idea underwrites which. Arrows read "you need this to understand that". Colour is the module where the concept is developed — or, with <b>Your mastery</b>, what your practice says about that chapter. Larger nodes are hubs.</p></div>
      <div class="row"><div class="seg" id="cg"><button type="button" data-g="all" class="on">All</button>${K.groups.map(g => `<button type="button" data-g="${g.id}">${esc(g.label.replace(/^The /, ''))}</button>`).join('')}</div>
        <div class="seg" id="clens"><button type="button" data-l="module" class="${lens === 'module' ? 'on' : ''}">Module</button><button type="button" data-l="mastery" class="${lens === 'mastery' ? 'on' : ''}">Your mastery</button></div></div>
      <div class="legend" id="clegend">${lens === 'mastery' ? MASTERY_LEGEND : MODULE_LEGEND}</div></div>
    <div class="map-ctrl"><button type="button" id="z-in">+</button><button type="button" id="z-out">−</button><button type="button" id="z-fit">⤢</button></div>
    <div class="map-side" id="cside"></div>
    <svg id="csvg" role="img" aria-label="Concept graph"></svg></div>`;
  const wrap = $('#cwrap', el), svg = d3.select('#csvg');
  svg.append('defs').html(`<marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--fg-3)"/></marker>`);
  const g = svg.append('g');
  const zoom = d3.zoom().scaleExtent([.3, 3]).on('zoom', e => g.attr('transform', e.transform)); svg.call(zoom).on('dblclick.zoom', null);
  let sim;
  function draw() {
    if (sim) sim.stop(); g.selectAll('*').remove();
    const nodes = K.nodes.filter(n => group === 'all' || n.group === group).map(n => ({ ...n }));
    const ids = new Set(nodes.map(n => n.id));
    const links = K.edges.filter(e => ids.has(e.s) && ids.has(e.t)).map(e => ({ source: e.s, target: e.t }));
    const deg = new Map(); links.forEach(l => { deg.set(l.source, (deg.get(l.source) || 0) + 1); deg.set(l.target, (deg.get(l.target) || 0) + 1); });
    const W = wrap.clientWidth, H = wrap.clientHeight;
    sim = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id(d => d.id).distance(l => 80 + 10 * Math.min(6, (deg.get(l.source.id) || 1)))).force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(W / 2, H / 2)).force('collide', d3.forceCollide(40)).force('x', d3.forceX(W / 2).strength(.04)).force('y', d3.forceY(H / 2).strength(.06));
    const link = g.append('g').selectAll('path').data(links).join('path').attr('class', 'concept-edge');
    const node = g.append('g').selectAll('g').data(nodes).join('g').attr('class', d => 'concept-node' + ((deg.get(d.id) || 0) >= 4 ? ' hub' : '') + (lens === 'mastery' ? ' mx lv-' + (LV.get(d.chapter)?.level || 'none') : '')).style('--mc', d => modVar(G.get(d.chapter)?.module)).style('cursor', 'pointer');
    node.append('circle').attr('r', d => 8 + Math.min(8, (deg.get(d.id) || 0) * 1.6));
    node.append('text').attr('dy', d => 22 + Math.min(8, (deg.get(d.id) || 0) * 1.6)).attr('text-anchor', 'middle').text(d => d.label);
    node.append('text').attr('dy', d => 34 + Math.min(8, (deg.get(d.id) || 0) * 1.6)).attr('text-anchor', 'middle').style('font', '500 9.5px var(--mono)').style('fill', 'var(--fg-3)').text(d => d.chapter || '');
    node.call(d3.drag().on('start', (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; }).on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; }).on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
    node.on('mouseenter', (e, d) => { const nb = new Set([d.id]); links.forEach(l => { if (l.source.id === d.id) nb.add(l.target.id); if (l.target.id === d.id) nb.add(l.source.id); }); node.style('opacity', n => nb.has(n.id) ? 1 : .2); link.classed('hl', l => l.source.id === d.id || l.target.id === d.id).style('opacity', l => l.source.id === d.id || l.target.id === d.id ? 1 : .12); })
      .on('mouseleave', () => { node.style('opacity', 1); link.classed('hl', false).style('opacity', 1); })
      .on('click', (e, d) => { e.stopPropagation(); side(d, links); });
    sim.on('tick', () => { link.attr('d', l => `M${l.source.x},${l.source.y} L${l.target.x},${l.target.y}`); node.attr('transform', d => `translate(${d.x},${d.y})`); });
    svg.on('click', () => side(null));
  }
  function side(d, links) {
    const box = $('#cside', el); if (!d) { box.classList.remove('on'); return; }
    const c = G.get(d.chapter); const ins = links.filter(l => l.target.id === d.id).map(l => l.source), outs = links.filter(l => l.source.id === d.id).map(l => l.target);
    box.classList.add('on'); box.style.setProperty('--mc', modVar(c?.module));
    box.innerHTML = h`<button class="close" type="button">×</button><span class="eyebrow">${esc(K.groups.find(x => x.id === d.group)?.label || '')}</span><h3>${esc(d.label)}</h3>
      ${c ? `<div class="kv"><span class="cid">${c.id}</span><span class="chip ${G.nodeState(c.id)}">${G.nodeState(c.id)}</span>${c.est_minutes ? `<span class="chip">${fmtMins(c.est_minutes)}</span>` : ''}</div><p>${esc(c.title)}: ${esc(c.objective || c.summary || '')}</p>` : ''}
      ${ins.length ? `<p><b style="color:var(--fg)">Builds on</b><br>${ins.map(n => esc(n.label)).join(' · ')}</p>` : ''}
      ${outs.length ? `<p><b style="color:var(--fg)">Feeds into</b><br>${outs.map(n => esc(n.label)).join(' · ')}</p>` : ''}
      ${c ? `<div class="row" style="margin-top:14px"><a class="btn primary sm" href="#/c/${c.id}">Open ${c.id}</a><a class="btn sm" href="#/map?c=${c.id}">Show on map</a></div>` : ''}`;
    box.querySelector('.close').onclick = () => side(null);
  }
  draw();
  // restyle in place: re-running the force layout would reshuffle the graph
  const recolor = () => g.selectAll('.concept-node').each(function (d) {
    this.classList.remove(...[...this.classList].filter(k => k === 'mx' || k.startsWith('lv-')));
    if (lens === 'mastery') this.classList.add('mx', 'lv-' + (LV.get(d.chapter)?.level || 'none'));
  });
  $$('#clens button', el).forEach(b => b.onclick = () => { lens = b.dataset.l; $$('#clens button', el).forEach(x => x.classList.toggle('on', x === b)); $('#clegend', el).innerHTML = lens === 'mastery' ? MASTERY_LEGEND : MODULE_LEGEND; history.replaceState(null, '', '#/concepts' + (lens === 'mastery' ? '?lens=mastery' : '')); recolor(); });
  $$('#cg button', el).forEach(b => b.onclick = () => { group = b.dataset.g; $$('#cg button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); svg.transition().call(zoom.transform, d3.zoomIdentity); });
  $('#z-in', el).onclick = () => svg.transition().call(zoom.scaleBy, 1.3);
  $('#z-out', el).onclick = () => svg.transition().call(zoom.scaleBy, .75);
  $('#z-fit', el).onclick = () => svg.transition().call(zoom.transform, d3.zoomIdentity);
  return () => sim && sim.stop();
}
export default { concepts };
