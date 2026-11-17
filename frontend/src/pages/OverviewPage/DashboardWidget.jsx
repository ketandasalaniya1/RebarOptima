import { DASHBOARD_WIDGETS } from '../../utils/dashboardLayout'

export default function DashboardWidget({
  item,
  index,
  editing,
  onDragStart,
  onDrop,
  onToggle,
  onSpan,
  children,
}) {
  if (!item || item.hidden) return null
  const title = DASHBOARD_WIDGETS.find((widget) => widget.id === item.id)?.title || item.id
  return (
    <section
      className={`dashboard-widget span-${item.span}${editing ? ' is-editing' : ''}`}
      style={{ order: index }}
      draggable={editing && item.canMove}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', item.id)
        onDragStart(item.id)
      }}
      onDragOver={(event) => {
        if (editing && item.canMove) event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(item.id)
      }}
    >
      {editing && (
        <div className="dashboard-widget-bar">
          <span className="dashboard-widget-title">{title}</span>
          {item.canMove && (
            <button type="button" className="dashboard-tool-btn" onClick={() => onSpan(item.id)}>
              Width
            </button>
          )}
          {item.canHide && !item.mandatory && (
            <button type="button" className="dashboard-tool-btn" onClick={() => onToggle(item.id)}>
              Remove
            </button>
          )}
        </div>
      )}
      <div className="dashboard-widget-body">{children}</div>
    </section>
  )
}
