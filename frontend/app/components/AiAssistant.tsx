'use client';

import { useState, useEffect } from 'react';
import { registerOpenChat } from '../lib/chat-store';
import FloatingBall from './FloatingBall';
import ChatDialog from './ChatDialog';

export default function AiAssistant() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    registerOpenChat(() => setOpen(true));
  }, []);

  return (
    <>
      <FloatingBall onClick={() => setOpen(true)} />
      {open && <ChatDialog onClose={() => setOpen(false)} />}
    </>
  );
}
