import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultLayout, resolveDashboard, sanitizeLayout, sanitizeTemplateMap } from './dashboardLayout.js'

test('a role template can hide a card and lock another', () => {
  const template = sanitizeLayout({
    columns: 6,
    widgets: [
      { id: 'diawise', hidden: true, canHide: false, canMove: false },
      { id: 'live-stock', mandatory: true, canHide: false },
    ],
  })
  const personal = {
    columns: 3,
    widgets: [
      { id: 'diawise', hidden: false },
      { id: 'live-stock', hidden: true },
      { id: 'scrap-stock', hidden: true },
    ],
  }
  const resolved = resolveDashboard(template, personal)
  const byId = Object.fromEntries(resolved.widgets.map((widget) => [widget.id, widget]))
  assert.equal(byId.diawise.hidden, true)
  assert.equal(byId['live-stock'].hidden, false)
  assert.equal(byId['scrap-stock'].hidden, true)
  assert.equal(resolved.columns, 3)
})

test('unknown widgets are dropped', () => {
  const layout = sanitizeLayout({ widgets: [{ id: 'revenue' }, { id: 'live-stock', span: 2 }] })
  assert.equal(layout.widgets.some((widget) => widget.id === 'revenue'), false)
  assert.equal(layout.widgets.find((widget) => widget.id === 'live-stock').span, 2)
})

test('template maps ignore financial and empty role names', () => {
  const templates = sanitizeTemplateMap({
    'Site Supervisor': { widgets: [{ id: 'revenue' }, { id: 'scrap-stock' }] },
    '': { widgets: [] },
  })
  assert.equal(templates['Site Supervisor'].widgets.some((widget) => widget.id === 'revenue'), false)
  assert.equal(Object.hasOwn(templates, ''), false)
  assert.equal(defaultLayout().widgets.length, 9)
})
