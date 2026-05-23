import { type DraftNote } from '../lib/store';

interface SidebarProps {
  drafts: DraftNote[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onCollapse: () => void;
}

export default function Sidebar({ drafts, activeId, onSelect, onNew, onDelete, collapsed, onCollapse }: SidebarProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    // Auto-close sidebar on mobile after selecting a note
    if (window.innerWidth <= 768) {
      onCollapse();
    }
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!collapsed && <div className="sidebar-backdrop" onClick={onCollapse} />}
      
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="dot"></span> TempNote
          </div>
          <button className="sidebar-close-btn" onClick={onCollapse} title="Close sidebar">×</button>
        </div>
        
        <div className="sidebar-actions">
          <button className="btn btn-lavender" onClick={onNew}>+ New Note</button>
        </div>

        <div className="sidebar-list">
          {drafts.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '20px' }}>
              No drafts yet
            </div>
          )}
          {drafts.map(draft => (
            <div 
              key={draft.id}
              className={`sidebar-item ${activeId === draft.id ? 'active' : ''}`}
              onClick={() => handleSelect(draft.id)}
            >
              <div className="sidebar-item-title">
                {draft.title || 'Untitled'}
              </div>
              <button 
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this draft?')) onDelete(draft.id);
                }}
                title="Delete draft"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        
        <div className="sidebar-footer">
          {drafts.length} Local Draft{drafts.length !== 1 ? 's' : ''}
        </div>
      </div>
    </>
  );
}

