'use strict';
// Turns a queued capture into the text of the post.
//
// POST_TEMPLATE placeholders: {species} {rarity} {shiny} {cp} {city} {cc}
// {citytag} {date} {time} {map} {trainer}
const DEFAULT_TEMPLATE = '💩 {species}{shiny} spotted in {city} · {date} {time} UTC\n{map}\n#mierdasdelmundo #{citytag}';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function cityTag(city) {
  return String(city || 'somewhere').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '');
}

function mapLink(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '';
  const a = lat.toFixed(3), b = lng.toFixed(3);
  return `https://www.openstreetmap.org/?mlat=${a}&mlon=${b}#map=17/${a}/${b}`;
}

function render(item, template) {
  const d = new Date(item.ts || Date.now());
  const vars = {
    species: item.species || 'A poop',
    rarity: RARITY_ORDER.includes(item.rarity) ? item.rarity : 'common',
    shiny: item.shiny ? ' ✨' : '',
    cp: item.cp != null ? String(item.cp) : '',
    city: item.city || 'an unknown city',
    cc: item.cc || '',
    citytag: cityTag(item.city),
    date: d.toISOString().slice(0, 10),
    time: d.toISOString().slice(11, 16),
    map: mapLink(item.lat, item.lng),
    trainer: item.trainer || 'a trainer',
  };
  let text = String(template || process.env.POST_TEMPLATE || DEFAULT_TEMPLATE)
    .replace(/\\n/g, '\n')
    .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  // X counts every link as 23 characters; keep the rest comfortably inside the limit.
  const links = (text.match(/https?:\/\/\S+/g) || []);
  const budget = 280 - links.length * 23;
  const plain = text.replace(/https?:\/\/\S+/g, '');
  if (plain.length > budget) {
    const cut = budget - 1;
    text = text.replace(/\n?#\S+/g, '');
    if (text.replace(/https?:\/\/\S+/g, '').length > budget) text = text.slice(0, cut) + '…';
  }
  return text;
}

module.exports = { render, cityTag, mapLink, DEFAULT_TEMPLATE };
