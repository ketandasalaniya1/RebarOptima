/** Widgets backed by the overview stats already loaded for the active project. */
export const DASHBOARD_WIDGETS = [
  { id: 'live-stock', title: 'Live stock', category: 'Inventory', span: 1 },
  { id: 'scrap-stock', title: 'Scrap stock', category: 'Inventory', span: 1 },
  { id: 'scrap-percent', title: 'Scrap percentage', category: 'Inventory', span: 1 },
  { id: 'steel-purchased', title: 'Steel purchased', category: 'Inventory', span: 1 },
  { id: 'scrap-sold', title: 'Scrap sold', category: 'Inventory', span: 1 },
  { id: 'scrap-loss', title: 'Unrecovered scrap', category: 'Inventory', span: 1 },
  { id: 'diawise', title: 'Diawise live stock', category: 'Inventory', span: 3 },
  { id: 'scrap-trend', title: 'Daily scrap', category: 'Activity', span: 3 },
  { id: 'quick-actions', title: 'Quick actions', category: 'Quick actions', span: 6 },
]

const ALLOWED = new Set(DASHBOARD_WIDGETS.map((widget) => widget.id))
const COLUMN_CHOICES = [2, 3, 4, 6]

export function isFirmAdmin(user) {
  const role = String(user?.role || user?.roleName || '').toUpperCase()
  return role === 'ADMIN' || role === 'OWNER' || user?.accountType === 'developer'
}

export function defaultLayout() {
  return {
    columns: 6,
    widgets: DASHBOARD_WIDGETS.map((widget) => ({
      id: widget.id,
      span: widget.span,
      hidden: false,
      mandatory: false,
      canHide: true,
      canMove: true,
    })),
  }
}

function widgetSpec(id) {
  return DASHBOARD_WIDGETS.find((widget) => widget.id === id)
}

export function sanitizeLayout(input) {
  const source = Array.isArray(input?.widgets) ? input.widgets : []
  const seen = new Set()
  const widgets = []
  for (const item of source) {
    if (!item || !ALLOWED.has(item.id) || seen.has(item.id)) continue
    seen.add(item.id)
    const spec = widgetSpec(item.id)
    const span = [1, 2, 3, 6].includes(Number(item.span)) ? Number(item.span) : spec.span
    widgets.push({
      id: item.id,
      span,
      hidden: Boolean(item.hidden),
      mandatory: Boolean(item.mandatory),
      canHide: item.canHide !== false,
      canMove: item.canMove !== false,
    })
  }
  for (const spec of DASHBOARD_WIDGETS) {
    if (seen.has(spec.id)) continue
    widgets.push({
      id: spec.id,
      span: spec.span,
      hidden: false,
      mandatory: false,
      canHide: true,
      canMove: true,
    })
  }
  const columns = COLUMN_CHOICES.includes(Number(input?.columns)) ? Number(input.columns) : 6
  return { columns, widgets }
}

export function resolveDashboard(template, personal) {
  const base = sanitizeLayout(template || defaultLayout())
  if (!personal || !Array.isArray(personal.widgets)) return base
  const rules = Object.fromEntries(base.widgets.map((widget) => [widget.id, widget]))
  const mine = sanitizeLayout(personal)
  const allMovable = base.widgets.every((widget) => widget.canMove)
  const merge = (rule, item) => ({
    ...rule,
    hidden: rule.hidden ? true : (rule.mandatory || rule.canHide === false ? false : Boolean(item.hidden)),
    canHide: rule.hidden ? false : rule.canHide,
    span: rule.canMove ? item.span : rule.span,
  })
  const widgets = allMovable
    ? mine.widgets.map((item) => merge(rules[item.id], item))
    : base.widgets.map((rule) => merge(rule, mine.widgets.find((item) => item.id === rule.id) || rule))
  const columns = COLUMN_CHOICES.includes(Number(personal.columns)) ? Number(personal.columns) : base.columns
  return { columns, widgets }
}

export function cycleSpan(span) {
  if (span >= 6) return 1
  if (span >= 3) return 6
  if (span >= 2) return 3
  return 2
}

export function sanitizeTemplateMap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const templates = {}
  for (const [role, layout] of Object.entries(input)) {
    const name = String(role).trim().slice(0, 80)
    if (!name) continue
    templates[name] = sanitizeLayout(layout)
  }
  return templates
}
