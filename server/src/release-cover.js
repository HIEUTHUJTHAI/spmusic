const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
function splitTitle(value) {
  const [name, ...guests] = value.replace(/\s*[|(\[]?\s*(?:official music video|official audio|official mv)\s*[)\]]?\s*$/i,'').split(/\s+(?:ft\.?|feat\.?)\s+/i);
  return { name: normalize(name), guests: guests.map(normalize) };
}
export async function releaseCover(title, artist, request = fetch) {
  const parts = title.split(/\s+[-–—]\s+/);
  const credits = parts.length === 2 ? [artist, parts[0]] : [artist];
  const wanted = splitTitle(parts.length === 2 ? parts[1] : title);
  const query = new URLSearchParams({term: [parts.length === 2 ? parts[0] : artist, wanted.name].join(' '), country:'VN', entity:'song', limit:'20'});
  const response = await request('https://itunes.apple.com/search?' + query, {signal:AbortSignal.timeout(5000)});
  if (!response.ok) return null;
  const {results} = await response.json();
  for (const song of results || []) {
    const found = splitTitle(song.trackName || '');
    const artists = normalize(song.artistName);
    if (!wanted.name || found.name !== wanted.name || !credits.some(c => normalize(c) && (' '+artists+' ').includes(' '+normalize(c)+' '))) continue;
    if (!wanted.guests.every(g => (' '+[artists,...found.guests].join(' ')+' ').includes(' '+g+' '))) continue;
    if (!song.artworkUrl100) continue;
    const image = new URL(song.artworkUrl100);
    if (image.protocol === 'https:' && image.hostname.endsWith('.mzstatic.com')) return image.href.replace(/100x100bb(?=\.)/, '600x600bb');
  }
  return null;
}
