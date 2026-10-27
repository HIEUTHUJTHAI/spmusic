import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './forms.css';

export default function Modal({ title, onClose, children, wide = false }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () =>
      [
        ...(dialog.current?.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ) || []),
      ].filter((el) => !el.hidden && el.offsetParent !== null);
    const initial =
      dialog.current?.querySelector('[autofocus], [data-autofocus]') || focusable()[0];
    initial?.focus();
    function keydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current?.();
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.current?.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-shade"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialog}
        className={`aural-modal ${wide ? 'aural-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="modal-heading">
          <div>
            <span className="modal-eyebrow">KHÔNG GIAN CỦA BẠN</span>
            <h2>{title}</h2>
          </div>
          <button className="form-icon-button" type="button" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
