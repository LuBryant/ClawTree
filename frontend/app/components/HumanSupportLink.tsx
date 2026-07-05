'use client';

import { openChat } from '../lib/chat-store';
import { useLanguage } from '../i18n/LanguageProvider';

export default function HumanSupportLink() {
  const { tx } = useLanguage();
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
      {tx('客服咨询', 'Support')}
    </a>
  );
}
