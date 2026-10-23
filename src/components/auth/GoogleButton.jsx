import React, { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID as CLIENT_ID } from '../../config/google';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise;
const loadGoogleScript = () => {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptPromise;
};

// "Sign in with Google" via Google Identity Services; hidden until VITE_GOOGLE_CLIENT_ID is set
const GoogleButton = ({ onCredential, text = 'continue_with' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGoogleScript().then(() => {
      if (cancelled || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline', size: 'large', shape: 'pill', text, width: 320,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [onCredential, text]);

  if (!CLIENT_ID) return null;
  return <div ref={containerRef} className="flex justify-center min-h-[44px]" />;
};

export default GoogleButton;
