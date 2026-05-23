import { useState, useEffect } from 'react';
import { fetchSharedNote, unlockSharedNote } from '../lib/store';
import Preview from './Preview';

export default function SharedNote({ noteId }: { noteId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState<any>(null);
  
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  useEffect(() => {
    fetchSharedNote(noteId).then(res => {
      if (res.success) {
        setNote(res.data);
      } else {
        setError(res.error || 'Failed to load note');
      }
      setLoading(false);
    }).catch(err => {
      setError('Error connecting to server');
      setLoading(false);
    });
  }, [noteId]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError('');
    
    try {
      const res = await unlockSharedNote(noteId, password);
      if (res.success) {
        setNote(res.data);
      } else {
        setUnlockError(res.error || 'Incorrect password');
      }
    } catch (err) {
      setUnlockError('Error unlocking note');
    }
    setUnlocking(false);
  };

  if (loading) {
    return <div className="unlock-page"><h2>Loading note...</h2></div>;
  }

  if (error) {
    return (
      <div className="unlock-page">
        <div className="unlock-card" style={{ borderColor: 'var(--pink)' }}>
          <h2 style={{ marginBottom: '16px', color: '#d32f2f' }}>Error</h2>
          <p>{error}</p>
          <a href="/" className="btn btn-lavender" style={{ marginTop: '24px', textDecoration: 'none' }}>Go to TempNote</a>
        </div>
      </div>
    );
  }

  if (note?.has_password && !note.content) {
    return (
      <div className="unlock-page">
        <div className="unlock-card">
          <h2 style={{ marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>🔒 Protected Note</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>This note requires a password to view.</p>
          <form onSubmit={handleUnlock}>
            <input 
              type="password" 
              placeholder="Enter password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ marginBottom: '12px' }}
              autoFocus
            />
            {unlockError && <div style={{ color: '#d32f2f', fontSize: '13px', marginBottom: '12px' }}>{unlockError}</div>}
            <button type="submit" className="btn btn-mint" style={{ width: '100%', justifyContent: 'center' }} disabled={unlocking}>
              {unlocking ? 'Unlocking...' : 'Unlock Note'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const charCount = note.content ? note.content.length : 0;
  const wordCount = note.content ? note.content.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="app" style={{ flexDirection: 'column' }}>
      <header className="toolbar" style={{ padding: '12px 24px', justifyContent: 'space-between', borderBottom: 'var(--border-width) solid var(--border)' }}>
        <div className="sidebar-logo">
          <span className="dot"></span> TempNote Shared
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 'bold' }}>
          {note.title}
        </div>
        <a href="/" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>Create your own</a>
      </header>
      
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Preview content={note.content || ''} />
      </main>

      <div className="statusbar">
        <div className="statusbar-group">
          <span>{charCount} chars</span>
          <span>{wordCount} words</span>
        </div>
        <div className="statusbar-group">
          <span className="statusbar-badge badge-warning">Views: {note.view_count}</span>
          {note.expires_at && (
            <span className="statusbar-badge badge-active" title={`Expires at ${note.expires_at}`}>
              Expires: {new Date(note.expires_at + 'Z').toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
