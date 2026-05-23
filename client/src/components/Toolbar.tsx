interface ToolbarProps {
  onToggleSidebar: () => void;
  onTogglePreview: () => void;
  onShare: () => void;
  onDownloadMd: () => void;
  onDownloadTxt: () => void;
  onDownloadPdf: () => void;
  onHelp: () => void;
  previewOpen: boolean;
  isPublished: boolean;
  onUpdatePublished: () => void;
  onUnpublish: () => void;
}

export default function Toolbar({ 
  onToggleSidebar, 
  onTogglePreview, 
  onShare, 
  onDownloadMd, 
  onDownloadTxt, 
  onDownloadPdf,
  onHelp,
  previewOpen,
  isPublished,
  onUpdatePublished,
  onUnpublish
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="btn btn-ghost btn-icon" onClick={onToggleSidebar} title="Toggle Sidebar">
          ☰
        </button>
      </div>
      
      <div className="toolbar-sep"></div>
      
      <div className="toolbar-group">
        <button className={`btn btn-sm ${previewOpen ? 'btn-lavender' : 'btn-ghost'}`} onClick={onTogglePreview} title="Toggle Markdown Preview">
          Split View
        </button>
      </div>

      <div className="toolbar-sep"></div>
      
      <div className="toolbar-group">
        {!isPublished ? (
          <button className="btn btn-sm btn-pink" onClick={onShare}>
            🚀 Publish
          </button>
        ) : (
          <>
            <button className="btn btn-sm btn-lavender" onClick={onShare}>
              🔗 Share Link
            </button>
            <button className="btn btn-sm btn-pink" onClick={onUpdatePublished}>
              🔄 Update
            </button>
            <button className="btn btn-sm btn-ghost" style={{color: 'var(--red)'}} onClick={onUnpublish}>
              🗑️ Unpublish
            </button>
          </>
        )}
      </div>

      <div style={{ flex: 1 }}></div>

      <div className="toolbar-group">
        <button className="btn btn-ghost btn-sm" onClick={onDownloadMd} title="Download .md">⬇ MD</button>
        <button className="btn btn-ghost btn-sm" onClick={onDownloadTxt} title="Download .txt">⬇ TXT</button>
        <button className="btn btn-ghost btn-sm" onClick={onDownloadPdf} title="Download .pdf">⬇ PDF</button>
      </div>
      
      <div className="toolbar-sep"></div>
      
      <div className="toolbar-group">
        <button className="btn btn-ghost btn-icon" onClick={onHelp} title="Markdown Help">
          ?
        </button>
      </div>
    </div>
  );
}
