import { ExternalLink } from 'lucide-react';
import './source-credit.css';

// Keep attribution available for tracks imported before the source browser was retired.
export default function SourceCredit({ info }) {
  if (!info) return null;
  return (
    <div className="source-credit">
      <strong>{info.title}</strong>
      <p>{info.credit || info.artist}</p>
      <div>
        <a href={info.sourceUrl} target="_blank" rel="noreferrer">
          Nguồn: {info.providerName || info.source} <ExternalLink size={12} />
        </a>
        {info.license?.url && <a href={info.license.url} target="_blank" rel="noreferrer">
          {info.license.name} <ExternalLink size={12} />
        </a>}
      </div>
      {info.downloadedAt && (
        <p>
          Đã tải bản {info.format} · {new Date(info.downloadedAt).toLocaleDateString('vi-VN')}
          {info.provider !== 'youtube' && ' · Giữ nguyên nội dung âm thanh'}
        </p>
      )}
    </div>
  );
}
