const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
const clean = value => value.replace(/^\s*\d{1,2}[.)]\s+/, '').replace(/\s*[|(\[]?\s*(?:(?:official\s+)?music video|official audio|official mv|official video|lyric video|official visualizer)\s*[)\]]?\s*$/i,'').trim();
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
    const names = credit.split(/\s+(?:x|×|ft\.?|feat\.?|featuring|&)\s+/i).map(normalize);
    const query = new URLSearchParams({term:names[0]+' '+wanted.name, country:'VN', entity:'song', limit:'25'});
    const response = await request('https://itunes.apple.com/search?' + query, {signal:AbortSignal.timeout(5000)});
    if (!response.ok) continue;
    const {results} = await response.json();
    for (const song of results || []) {
      const found = titleInfo(song.trackName || '');
      const artists = normalize(song.artistName);
      if (!wanted.name || found.name !== wanted.name || !names.every(name => inCredits(name, [artists,...found.guests].join(' ')))) continue;
      if (!wanted.guests.every(g => inCredits(g,[artists,...found.guests].join(' ')))) continue;
      if (!song.artworkUrl100) continue;
      const image = new URL(song.artworkUrl100);
      if (image.protocol === 'https:' && image.hostname.endsWith('.mzstatic.com')) return image.href.replace(/100x100bb(?=\.)/, '600x600bb');
    }
    const search = new URLSearchParams({q:names[0]+' '+wanted.name, limit:'8'});
    const alternatives = await request('https://api.deezer.com/search?' + search, {signal:AbortSignal.timeout(5000)});
    if (!alternatives.ok) continue;
    const {data} = await alternatives.json();
    for (const item of data || []) {
      if (titleInfo(item.title).name !== wanted.name || !Number.isSafeInteger(item.id)) continue;
      if (![...names,...wanted.guests].includes(normalize(item.artist?.name))) continue;
      const details = await request('https://api.deezer.com/track/' + item.id, {signal:AbortSignal.timeout(5000)});
      if (!details.ok) continue;
      const song = await details.json();
      const credits = (song.contributors || []).map(person => normalize(person.name));
      if (![...names,...wanted.guests].every(name => credits.includes(name))) continue;
      if (!song.album?.cover_big) continue;
      const image = new URL(song.album.cover_big);
      if (image.protocol === 'https:' && image.hostname.endsWith('.dzcdn.net')) return image.href;
    }
  }
  return null;
}
