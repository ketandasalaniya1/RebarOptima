import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { LayoutGrid } from 'lucide-react'
import { companyApi, profileApi, rolesApi } from '../../utils/api'
import { setView } from '../../store/slices/routingSlice'
import { updateUserSuccess } from '../../store/slices/authSlice'
import {
  DASHBOARD_WIDGETS,
  defaultLayout,
  sanitizeLayout,
  sanitizeTemplateMap,
} from '../../utils/dashboardLayout'
import { Button, Select } from '../../components/ui'

const PREVIEW_KEY = 'dashboard_preview_role'

export default function DashboardTemplates({ user }) {
  const dispatch = useDispatch()
  const [roles, setRoles] = useState([])
  const [templates, setTemplates] = useState({})
  const [roleName, setRoleName] = useState('')
  const [draft, setDraft] = useState(defaultLayout())
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const list = await rolesApi.getRoles()
        if (cancel) return
        const names = (Array.isArray(list) ? list : []).map((role) => role.name).filter(Boolean)
        setRoles(names)
        let stored = sanitizeTemplateMap(user?.preferences?.dashboardTemplates)
        try {
          const remote = await companyApi.getDashboard()
          if (remote?.templates) stored = sanitizeTemplateMap(remote.templates)
        } catch {
          // The company route is absent until the API process reloads. The admin profile copy still works.
        }
        if (cancel) return
        setTemplates(stored)
        const first = names[0] || ''
        setRoleName(first)
        setDraft(sanitizeLayout(stored[first] || defaultLayout()))
      } catch (err) {
        if (!cancel) setError(err.message || 'Could not load roles.')
      }
    }
    load()
    return () => { cancel = true }
  }, [user])

  const selectRole = (name) => {
    setRoleName(name)
    setDraft(sanitizeLayout(templates[name] || defaultLayout()))
    setStatus('')
  }

  const updateWidget = (id, patch) => {
    setDraft((current) => ({
      ...current,
      widgets: current.widgets.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget)),
    }))
  }

  const save = async () => {
    const next = { ...templates, [roleName]: sanitizeLayout(draft) }
    setSaving(true)
    setError('')
    setStatus('')
    try {
      try {
        const remote = await companyApi.saveDashboard(next)
        if (remote?.templates) setTemplates(sanitizeTemplateMap(remote.templates))
        else setTemplates(next)
      } catch {
        setTemplates(next)
      }
      const profile = await profileApi.getProfile()
      const preferences = { ...(profile.preferences || {}), dashboardTemplates: next }
      await profileApi.updateProfile({ preferences })
      dispatch(updateUserSuccess({ preferences }))
      setStatus(`Saved the ${roleName} dashboard.`)
    } catch (err) {
      setError(err.message || 'Could not save the dashboard template.')
    } finally {
      setSaving(false)
    }
  }

  const resetRole = () => {
    setDraft(defaultLayout())
  }

  const preview = () => {
    sessionStorage.setItem(PREVIEW_KEY, roleName)
    dispatch(setView('overview'))
  }

  if (!roleName) {
    return (
      <div className="card settings-card">
        <h3 className="settings-card-title"><LayoutGrid size={18} /> Employee dashboards</h3>
        <p className="settings-card-desc">{error || 'No roles are available for dashboard templates.'}</p>
      </div>
    )
  }

  const grouped = DASHBOARD_WIDGETS.reduce((groups, widget) => {
    if (!groups[widget.category]) groups[widget.category] = []
    groups[widget.category].push(widget)
    return groups
  }, {})

  return (
    <div className="card settings-card">
      <h3 className="settings-card-title"><LayoutGrid size={18} /> Employee dashboards</h3>
      <p className="settings-card-desc">
        Choose which existing dashboard cards each role can see. People can only hide or move a card when you allow it.
      </p>
      <label className="dashboard-template-role">
        Role
        <Select aria-label="Dashboard role" value={roleName} onChange={(event) => selectRole(event.target.value)}>
          {roles.map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
      </label>
      {Object.entries(grouped).map(([category, widgets]) => (
        <div key={category} className="dashboard-template-group">
          <h4>{category}</h4>
          {widgets.map((widget) => {
            const item = draft.widgets.find((entry) => entry.id === widget.id)
            if (!item) return null
            return (
              <div key={widget.id} className="dashboard-template-row">
                <span>{widget.title}</span>
                <Button size="sm" variant="secondary" aria-pressed={!item.hidden} onClick={() => updateWidget(widget.id, { hidden: !item.hidden })}>{item.hidden ? 'Hidden' : 'Visible'}</Button>
                <Button size="sm" variant="secondary" aria-pressed={item.mandatory} onClick={() => updateWidget(widget.id, { mandatory: !item.mandatory, hidden: !item.mandatory ? false : item.hidden })}>{item.mandatory ? 'Mandatory' : 'Optional'}</Button>
                <Button size="sm" variant="secondary" aria-pressed={item.canHide && !item.mandatory} disabled={item.mandatory} onClick={() => updateWidget(widget.id, { canHide: !item.canHide })}>{item.canHide && !item.mandatory ? 'Can hide' : 'Cannot hide'}</Button>
                <Button size="sm" variant="secondary" aria-pressed={item.canMove} onClick={() => updateWidget(widget.id, { canMove: !item.canMove })}>{item.canMove ? 'Can move' : 'Locked'}</Button>
              </div>
            )
          })}
        </div>
      ))}
      <div className="dashboard-template-actions">
        <Button type="button" variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save template'}</Button>
        <Button type="button" variant="secondary" onClick={preview}>Preview</Button>
        <Button type="button" variant="secondary" onClick={resetRole}>Reset</Button>
      </div>
      {status && <p className="settings-save-success">{status}</p>}
      {error && <p className="dashboard-template-error" role="alert">{error}</p>}
    </div>
  )
}
