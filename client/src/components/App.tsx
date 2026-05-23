import { useState, useRef, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import { useNoteStore, publishNote, updatePublishedNote, deletePublishedNote } from '../lib/store';
import Editor from './Editor';
import type { EditorHandle } from './Editor';
import Preview from './Preview';
import Sidebar from './Sidebar';
import Toolbar from './Toolbar';
import MarkdownToolbar from './MarkdownToolbar';

export default function App() {
  const store = useNoteStore();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Modals
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishPassword, setPublishPassword] = useState('');
  const [publishExpiry, setPublishExpiry] = useState('1h');
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const qrCardRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorHandle>(null);
  const [editorReady, setEditorReady] = useState(false);
  
  const [toast, setToast] = useState('');
  
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleEditorChange = (value: string) => {
    if (!store.activeId) return;
    
    // Extract title from first line or use default
    const firstLine = value.split('\n')[0].replace(/^#+\s*/, '').trim();
    const title = firstLine || 'Untitled';
    
    store.updateNote(store.activeId, { content: value, title });
  };

  const activeNote = store.activeNote;
  
  // Stats
  const charCount = activeNote ? activeNote.content.length : 0;
  const wordCount = activeNote ? activeNote.content.split(/\s+/).filter(Boolean).length : 0;

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(v => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setPreviewOpen(v => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        showToast('Saved to local drafts');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const downloadFile = (ext: string, mime: string) => {
    if (!activeNote) return;
    const blob = new Blob([activeNote.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title || 'note'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    if (!activeNote) return;
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(activeNote.content, 180);
    doc.text(splitText, 15, 15);
    doc.save(`${activeNote.title || 'note'}.pdf`);
  };

  const handlePublish = async () => {
    if (!activeNote) return;
    try {
      const res = await publishNote(activeNote.title, activeNote.content, publishPassword, publishExpiry);
      if (res.success) {
        const baseUrl = import.meta.env.PUBLIC_BASE_URL || window.location.origin;
        const pubId = res.data.note.id;
        const token = res.data.admin_token;
        const link = `${baseUrl.replace(/\/$/, '')}/share/${pubId}`;
        setShareLink(link);
        
        // Save to draft so we can update/delete later
        store.updateNote(activeNote.id, { publishedId: pubId, adminToken: token });
      } else {
        showToast(res.error || 'Failed to publish');
      }
    } catch (err) {
      showToast('Error publishing note');
    }
  };

  const handleUpdatePublished = async () => {
    if (!activeNote || !activeNote.publishedId || !activeNote.adminToken) return;
    try {
      const res = await updatePublishedNote(activeNote.publishedId, activeNote.title, activeNote.content, activeNote.adminToken);
      if (res.success) {
        showToast('Published note updated!');
      } else {
        showToast(res.error || 'Failed to update');
      }
    } catch (err) {
      showToast('Error updating note');
    }
  };

  const handleUnpublish = async () => {
    if (!activeNote || !activeNote.publishedId || !activeNote.adminToken) return;
    if (!confirm('Are you sure you want to unpublish this note? It will be deleted from the server.')) return;
    
    try {
      const res = await deletePublishedNote(activeNote.publishedId, activeNote.adminToken);
      if (res.success) {
        store.updateNote(activeNote.id, { publishedId: undefined, adminToken: undefined });
        showToast('Note unpublished successfully');
      } else {
        showToast(res.error || 'Failed to unpublish');
      }
    } catch (err) {
      showToast('Error unpublishing note');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    showToast('Link copied!');
  };

  const captureQRCard = useCallback(async (): Promise<Blob | null> => {
    if (!qrCardRef.current) return null;
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(qrCardRef.current, {
      backgroundColor: null,
      scale: 3,
      useCORS: true,
    });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }, []);

  const handleShareCard = async () => {
    setIsSharing(true);
    try {
      const blob = await captureQRCard();
      if (!blob) { showToast('Failed to capture card'); return; }

      const file = new File([blob], 'tempnote-share.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: activeNote?.title || 'TempNote',
          text: `Check out this note: ${shareLink}`,
          files: [file],
        });
        showToast('Shared!');
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tempnote-share.png';
        a.click();
        URL.revokeObjectURL(url);
        showToast('QR card downloaded!');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') showToast('Share failed');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadCard = async () => {
    const blob = await captureQRCard();
    if (!blob) { showToast('Failed to capture card'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote?.title || 'note'}-qr.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('QR card saved!');
  };

  return (
    <div className="app">
      <Sidebar 
        drafts={store.drafts} 
        activeId={store.activeId}
        onSelect={store.openNote}
        onNew={store.createNote}
        onDelete={store.deleteNote}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(true)}
      />
      
      <main className="main">
        {/* Tabbar */}
        <div className="tabbar">
          {store.openNotes.map(note => (
            <div 
              key={note.id} 
              className={`tab ${store.activeId === note.id ? 'active' : ''}`}
              onClick={() => store.setActiveId(note.id)}
            >
              <span className="tab-title">{note.title || 'Untitled'}</span>
              <button 
                className="tab-close" 
                onClick={(e) => {
                  e.stopPropagation();
                  store.closeTab(note.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button className="tab-new" onClick={store.createNote} title="New Note">+</button>
        </div>

        {activeNote ? (
          <>
            <Toolbar 
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
              onTogglePreview={() => setPreviewOpen(!previewOpen)}
              onShare={() => {
                if (activeNote.publishedId) {
                  const baseUrl = import.meta.env.PUBLIC_BASE_URL || window.location.origin;
                  setShareLink(`${baseUrl.replace(/\/$/, '')}/share/${activeNote.publishedId}`);
                } else {
                  setShareLink('');
                }
                setPublishPassword('');
                setPublishExpiry('1h');
                setPublishModalOpen(true);
              }}
              onDownloadMd={() => downloadFile('md', 'text/markdown')}
              onDownloadTxt={() => downloadFile('txt', 'text/plain')}
              onDownloadPdf={downloadPDF}
              onHelp={() => setHelpOpen(true)}
              previewOpen={previewOpen}
              isPublished={!!activeNote.publishedId}
              onUpdatePublished={handleUpdatePublished}
              onUnpublish={handleUnpublish}
            />
            
            <MarkdownToolbar editorView={editorRef.current?.getView() ?? null} />
            
            <div className="editor-area">
              <Editor 
                ref={editorRef}
                initialValue={activeNote.content} 
                onChange={handleEditorChange}
                onReady={() => setEditorReady(true)}
              />
              {previewOpen && <Preview content={activeNote.content} />}
            </div>

            <div className="statusbar">
              <div className="statusbar-group">
                <span>{charCount} chars</span>
                <span>{wordCount} words</span>
              </div>
              <div className="statusbar-group">
                <span className="statusbar-badge">Markdown Supported</span>
                <span>Local Draft • Autosaved</span>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>TempNote</h2>
            <p>A beautiful, fast, and ephemeral markdown notepad. Notes are autosaved locally in your browser.</p>
            <button className="btn btn-lavender" onClick={store.createNote} style={{ marginTop: '20px', padding: '10px 20px', fontSize: '15px' }}>
              Create a Note
            </button>
            <div className="shortcuts" style={{ marginTop: '40px' }}>
              <div><kbd>Ctrl</kbd> + <kbd>B</kbd> Toggle Sidebar</div>
              <div><kbd>Ctrl</kbd> + <kbd>P</kbd> Toggle Preview</div>
            </div>
          </div>
        )}
      </main>

      {/* Publish Modal */}
      {publishModalOpen && (
        <div className="modal-overlay" onClick={() => !shareLink && setPublishModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {!shareLink ? (
              <>
                <h3>🚀 Publish Note</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Generate a temporary link to share this note with others. Your local draft will remain safe.</p>
                
                <label>Expires In</label>
                <select value={publishExpiry} onChange={e => setPublishExpiry(e.target.value)}>
                  <option value="1h">1 Hour</option>
                  <option value="6h">6 Hours</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="never">Never (Keep Forever)</option>
                </select>

                <label>Password Protect (Optional)</label>
                <input 
                  type="password" 
                  placeholder="Leave blank for no password" 
                  value={publishPassword}
                  onChange={e => setPublishPassword(e.target.value)}
                />

                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setPublishModalOpen(false)}>Cancel</button>
                  <button className="btn btn-pink" onClick={handlePublish}>Publish Now</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                {/* Shareable QR Card */}
                <div ref={qrCardRef} className="share-card">
                  <div className="share-card-header">
                    <span className="share-card-dot"></span>
                    <span className="share-card-brand">TempNote</span>
                  </div>
                  <div className="share-card-title">{activeNote?.title || 'Untitled'}</div>
                  <div className="share-card-qr">
                    <QRCodeCanvas
                      value={shareLink}
                      size={160}
                      level="M"
                      bgColor="#FFFFFF"
                      fgColor="#2D2D2D"
                      style={{ borderRadius: '8px' }}
                    />
                  </div>
                  <div className="share-card-link">{shareLink.replace(/^https?:\/\//, '')}</div>
                  <div className="share-card-badge">Scan to view note</div>
                </div>

                {/* Link + Actions */}
                <input type="text" readOnly value={shareLink} onClick={e => e.currentTarget.select()} style={{ textAlign: 'center', width: '100%' }} />
                <div className="modal-actions" style={{ width: '100%', justifyContent: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <button className="btn btn-mint" onClick={handleShareCard} disabled={isSharing}>
                    {isSharing ? '⏳ Preparing...' : '📤 Share Card'}
                  </button>
                  <button className="btn btn-sky" onClick={handleDownloadCard}>⬇ Save Card</button>
                  <button className="btn btn-lavender" onClick={copyLink}>📋 Copy Link</button>
                  <button className="btn btn-ghost" onClick={() => setPublishModalOpen(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Markdown Help Drawer */}
      {helpOpen && (
        <div className="md-help">
          <div className="md-help-header">
            Markdown Guide
            <button className="btn btn-ghost btn-icon" onClick={() => setHelpOpen(false)}>×</button>
          </div>
          <div className="md-help-body">
            <div className="md-help-item">
              <span className="syntax"># Heading 1</span>
              <span className="syntax">## Heading 2</span>
              <span className="desc">Create headings by adding hashes.</span>
            </div>
            <div className="md-help-item">
              <span className="syntax">**bold text**</span>
              <span className="syntax">*italic text*</span>
              <span className="desc">Emphasis.</span>
            </div>
            <div className="md-help-item">
              <span className="syntax">- List item 1</span>
              <span className="syntax">- List item 2</span>
              <span className="desc">Unordered lists.</span>
            </div>
            <div className="md-help-item">
              <span className="syntax">[Link Text](url)</span>
              <span className="desc">Create hyperlinks.</span>
            </div>
            <div className="md-help-item">
              <span className="syntax">```javascript</span>
              <span className="syntax">code block</span>
              <span className="syntax">```</span>
              <span className="desc">Fenced code blocks with language support.</span>
            </div>
            <div className="md-help-item">
              <span className="syntax">&gt; Blockquote</span>
              <span className="desc">Quoted text.</span>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
