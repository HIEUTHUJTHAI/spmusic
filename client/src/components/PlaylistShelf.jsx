import {useState} from 'react';
import {Plus,Check} from 'lucide-react';
import Modal from './Modal';
import './playlist.css';

const fold = text=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d');
export default function PlaylistShelf({playlist,tracks,change,onClose}) {
  const [query,setQuery]=useState(''), [busy,setBusy]=useState(false), [last,setLast]=useState(null), [error,setError]=useState('');
  async function update(track,add) {
    setBusy(true); setError('');
    try {await change(track.id,add);setLast(add?track:null)} catch(e){setError(e.message)} finally{setBusy(false)}
  }
  const term=fold(query.trim()),visible=tracks.filter(t=>fold([t.title,t.artist,t.album].join(' ')).includes(term));
  return <Modal title={'Thêm vào '+playlist.name} onClose={()=>!busy&&onClose()}>
    <section className="playlist-shelf">
      <label className="form-label"><input type="search" data-autofocus aria-label="Tìm trong thư viện" placeholder="Tìm bài hát, nghệ sĩ, album…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="shelf-list">{visible.map(t=>{
        const included=playlist.trackIds.includes(t.id);
        return <div className="shelf-track" key={t.id}><img alt="" src={t.coverUrl||'/favicon.svg'}/><div><strong>{t.title}</strong><small>{t.artist}</small></div>
          <button className="icon-btn" aria-label={(included?'Đã có ':'Thêm ')+t.title} disabled={busy||included} onClick={()=>update(t,true)}>{included?<Check size={18}/>:<Plus size={18}/>}</button></div>
      })}{!visible.length&&<p>Không có bài hát phù hợp.</p>}</div>
      {error&&<p role="alert">{error}</p>}
      {last&&<footer role="status">Đã thêm {last.title} <button disabled={busy} onClick={()=>update(last,false)}>Hoàn tác</button></footer>}
    </section></Modal>
}
