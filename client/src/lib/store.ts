import { useState, useCallback, useEffect } from 'react';

export interface DraftNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'tempnote_drafts';
const ACTIVE_KEY = 'tempnote_active';
const OPEN_KEY = 'tempnote_open';

function loadDrafts(): DraftNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDrafts(drafts: DraftNote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

function loadOpenIds(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useNoteStore() {
  const [drafts, setDrafts] = useState<DraftNote[]>(loadDrafts);
  const [openIds, setOpenIds] = useState<string[]>(loadOpenIds);
  const [activeId, setActiveIdState] = useState<string | null>(loadActiveId);

  useEffect(() => { saveDrafts(drafts); }, [drafts]);
  useEffect(() => { localStorage.setItem(OPEN_KEY, JSON.stringify(openIds)); }, [openIds]);
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [activeId]);

  const setActiveId = useCallback((id: string | null) => { setActiveIdState(id); }, []);

  const createNote = useCallback(() => {
    const note: DraftNote = {
      id: generateId(),
      title: 'Untitled',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDrafts(prev => [note, ...prev]);
    setOpenIds(prev => [...prev, note.id]);
    setActiveIdState(note.id);
    return note;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Pick<DraftNote, 'title' | 'content'>>) => {
    setDrafts(prev => prev.map(n =>
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    ));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setDrafts(prev => prev.filter(n => n.id !== id));
    setOpenIds(prev => {
      const next = prev.filter(oid => oid !== id);
      if (activeId === id) {
        setActiveIdState(next.length > 0 ? next[next.length - 1] : null);
      }
      return next;
    });
  }, [activeId]);

  const openNote = useCallback((id: string) => {
    setOpenIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setActiveIdState(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setOpenIds(prev => {
      const idx = prev.indexOf(id);
      const next = prev.filter(oid => oid !== id);
      if (activeId === id) {
        const newActive = next.length > 0
          ? next[Math.min(idx, next.length - 1)]
          : null;
        setActiveIdState(newActive);
      }
      return next;
    });
  }, [activeId]);

  const activeNote = drafts.find(n => n.id === activeId) || null;
  const openNotes = openIds.map(id => drafts.find(n => n.id === id)).filter(Boolean) as DraftNote[];

  return {
    drafts, openNotes, activeNote, activeId,
    createNote, updateNote, deleteNote,
    openNote, closeTab, setActiveId,
  };
}

// API helpers
const API = '/api';

export async function publishNote(title: string, content: string, password: string, expireIn: string) {
  const res = await fetch(`${API}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, password, expire_in: expireIn }),
  });
  return res.json();
}

export async function fetchSharedNote(id: string) {
  const res = await fetch(`${API}/notes/${id}`);
  return res.json();
}

export async function unlockSharedNote(id: string, password: string) {
  const res = await fetch(`${API}/notes/${id}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.json();
}
