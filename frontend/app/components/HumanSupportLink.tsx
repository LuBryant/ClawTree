'use client';

import { openChat } from '../lib/chat-store';

export default function HumanSupportLink() {
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); openChat(); }}
      className="text-xs font-bold tracking-wide"
      style={{
        color: 'var(--warning)',
        border: '1px solid rgba(248,214,109,0.35)',
        background: 'rgba(248,214,109,0.08)',
        padding: '3px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      客服咨询
    </a>
  );
}
