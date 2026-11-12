/* Chapter mind maps built from the heading outline (H2 → H3), so they are
   accurate by construction. Small: a left-to-right tree in the side panel.
   Large: a radial map in a modal with pan/zoom. */
import * as d3 from 'd3';
import { esc, modal, modVar } from './ui.js';

function outline(c, secs) {
  const byAnchor = new Map((c.sections || []).map(s => [s.anchor, s]));
  const kids = secs.filter(s => !/^(sources|further reading)$/i.test(s.h)).map(s => ({ name: s.h, anchor: s.anchor, words: byAnchor.get(s.anchor)?.words || 0,
    children: (byAnchor.get(s.anchor)?.sub || []).map(x => ({ name: x.h, anchor: x.anchor })) }));
  return { name: c.title, anchor: '', children: kids };
}

export function mindmapSmall(el, c, secs, prog, onPick) {
  const data = outline(c, secs);
  const root = d3.hierarchy(data);
  const leaves = root.descendants().length;
  const W = el.clientWidth || 244, H = Math.max(200, leaves * 15);
  const tree = d3.cluster().size([H - 20, W - 130]);
  tree(root);
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const g = svg.append('g').attr('transform', 'translate(10,10)');
  g.selectAll('path').data(root.links()).join('path').attr('class', 'mm-link')
    .attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x));
  const node = g.selectAll('g').data(root.descendants()).join('g')
    .attr('class', d => 'mm-node' + (d.depth === 0 ? ' root' : '') + (prog?.sections?.[d.data.anchor] ? ' read' : ''))
    .attr('transform', d => `translate(${d.y},${d.x})`);
  node.append('circle').attr('r', d => d.depth === 0 ? 5 : d.depth === 1 ? 3.5 : 2.5);
  node.append('text').attr('dy', '0.32em').attr('x', d => d.depth === 0 ? -8 : 7).attr('text-anchor', d => d.depth === 0 ? 'end' : 'start')
    .text(d => d.depth === 0 ? '' : trunc(d.data.name, d.depth === 1 ? 22 : 18))
    .append('title').text(d => d.data.name);
  node.on('click', (e, d) => { if (d.data.anchor) onPick(d.data.anchor); });
}

export function mindmapModal(c, secs, prog, onPick) {
  const m = modal(`<button class="close" type="button">×</button><span class="eyebrow">Mind map</span><h2 style="font-size:19px">${esc(c.title)}</h2><p class="dim" style="font-size:12.5px">Built from the chapter's own headings. Click a node to jump there. Drag to pan, wheel to zoom.</p><div id="mm-big" style="height:min(70vh,640px);margin-top:10px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg)"></div>`);
  m.querySelector('.box').style.width = 'min(1100px,100%)';
  m.querySelector('.close').onclick = () => m.remove();
  const el = m.querySelector('#mm-big');
  const W = el.clientWidth, H = el.clientHeight, R = Math.min(W, H) / 2 - 40;
  const data = outline(c, secs);
  const root = d3.hierarchy(data);
  d3.tree().size([2 * Math.PI, R]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)(root);
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).style('--mc', modVar(c.module));
  const g = svg.append('g').attr('transform', `translate(${W / 2},${H / 2})`);
  svg.call(d3.zoom().scaleExtent([.4, 3]).on('zoom', e => g.attr('transform', `translate(${W / 2},${H / 2}) ${e.transform}`)));
  g.selectAll('path').data(root.links()).join('path').attr('class', 'mm-link').attr('stroke-width', d => d.target.depth === 1 ? 1.8 : 1)
    .attr('d', d3.linkRadial().angle(d => d.x).radius(d => d.y));
  const node = g.selectAll('g').data(root.descendants()).join('g')
    .attr('class', d => 'mm-node' + (d.depth === 0 ? ' root' : '') + (prog?.sections?.[d.data.anchor] ? ' read' : ''))
    .attr('transform', d => d.depth === 0 ? '' : `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);
  node.append('circle').attr('r', d => d.depth === 0 ? 14 : d.depth === 1 ? 5 : 3);
  node.filter(d => d.depth === 0).append('text').attr('text-anchor', 'middle').attr('dy', '0.32em').style('font-size', '12px').style('font-weight', '650').style('fill', 'var(--fg)')
    .text(c.id);
  node.filter(d => d.depth > 0).append('text').attr('dy', '0.32em').style('font-size', d => d.depth === 1 ? '12px' : '10.5px')
    .attr('x', d => (d.x < Math.PI) === !d.children ? 8 : -8).attr('text-anchor', d => (d.x < Math.PI) === !d.children ? 'start' : 'end')
    .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null).text(d => trunc(d.data.name, 34)).append('title').text(d => d.data.name);
  node.on('click', (e, d) => { if (d.data.anchor) { m.remove(); onPick(d.data.anchor); } });
}
const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
