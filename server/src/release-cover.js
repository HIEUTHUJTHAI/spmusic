const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
const clean = value => value.replace(/^\s*\d{1,2}[.)]\s+/, '').replace(/\s*[|(\[]?\s*(?:official music video|official audio|official mv|official video|lyric video|official visualizer)\s*[)\]]?\s*$/i,'').trim();
const inCredits = (name, credits) => Boolean(name && (' '+credits+' ').includes(' '+name+' '));
function titleInfo(value) {
  const [name, ...guests] = clean(value).split(/\s*[(\[]?\b(?:ft|feat|featuring)\.?\s+/i);
  return { name:normalize(name), guests:guests.map(normalize) };
}
export async function releaseCover(title, artist, request = fetch) {
  const parts = clean(title).split(/\s+[-–—]\s+/);
  const channel = artist.split(/\s*\/\s*/)[0].replace(/\s+(?:Official|Topic|Official Channel)$/i,'').trim();
  const candidates = parts.length === 2 ? [[parts[1], parts[0]], [parts[0], parts[1]]] : [[title,channel]];
  if (parts.length === 2 && inCredits(normalize(parts[1]), normalize(channel))) candidates.reverse();
  for (const [track, credit] of candidates) {
    const wanted = titleInfo(track);
    const query = new URLSearchParams({term:credit+' '+wanted.name, country:'VN', entity:'song', limit:'25'});
    const response = await request('https://itunes.apple.com/search?' + query, {signal:AbortSignal.timeout(5000)});
    if (!response.ok) continue;
    const {results} = await response.json();
    for (const song of results || []) {
      const found = titleInfo(song.trackName || '');
      const artists = normalize(song.artistName);
      if (!wanted.name || found.name !== wanted.name || !inCredits(normalize(credit),artists)) continue;
      if (!wanted.guests.every(g => inCredits(g,[artists,...found.guests].join(' ')))) continue;
      if (!song.artworkUrl100) continue;
      const image = new URL(song.artworkUrl100);
      if (image.protocol === 'https:' && image.hostname.endsWith('.mzstatic.com')) return image.href.replace(/100x100bb(?=\.)/, '600x600bb');
    }
  }
  return null;
}
