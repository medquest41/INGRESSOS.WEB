import './EditorSection.css'
export default function EditorSection({title,children,className=''}){
 return <details className={'editor-disclosure '+className} aria-label={title}><summary><strong>{title}</strong><span className="editor-disclosure-action" aria-hidden="true"><span className="editor-open-label">Abrir ▾</span><span className="editor-close-label">Recolher ▴</span></span></summary><div className="editor-disclosure-content">{children}</div></details>
}
