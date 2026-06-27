'use client';

import { useState } from 'react';
import FloatingBall from './FloatingBall';
import ChatDialog from './ChatDialog';

export default function AiAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <FloatingBall onClick={() => setOpen(true)} />
      {open && <ChatDialog onClose={() => setOpen(false)} />}
    </>
  );
}
