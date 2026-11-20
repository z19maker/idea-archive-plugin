/**
 * Route and bundle-contract tests.
 *
 * The route test mounts the plugin on a fake Host context, captures the real
 * `/idea-archive/api` handler, and drives it with mock node:http objects. The
 * bundle test checks the static contracts the Client module system reads.
 */

import assert from 'node:assert/strict'
import { readFile, rm } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply } from '../index.js'

const sample = await readFile(new URL('./fixtures/openwrt-duckai.txt', import.meta.url), 'utf8')

/** @returns {Promise<string>} a fresh archive directory. */
async function scratch() {
  return mkdtemp(join(tmpdir(), 'idea-archive-route-'))
}

/** Mount the plugin and capture its tools and routes. */
function mount() {
  const tools = []
  const routes = []
  const ctx = {
    effect(callback) {
      const disposer = callback()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    tools: {
      register(definition) {
        tools.push(definition)
        return () => {}
      },
    },
    inject(_names, callback) {
      callback({
        effect(callback) {
          const disposer = callback()
          return typeof disposer === 'function' ? disposer : () => {}
        },
        webServer: {
          register(route) {
            routes.push(route)
            return () => {}
          },
        },
      })
    },
  }
  apply(ctx)
  const route = routes.find(candidate => candidate.path === '/idea-archive/api')
  assert.ok(route, 'the plugin registers its API route')
  return { tools, route }
}

/** One mock request carrying an optional JSON body. */
function makeRequest(method, query = '', body = undefined) {
  const chunks = body === undefined ? [] : [Buffer.from(body, 'utf8')]
  return {
    method,
    url: `/idea-archive/api${query}`,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

/** One mock response that records what the handler wrote. */
function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
    },
    end(body) {
      if (typeof body === 'string') this.body += body
    },
  }
}

/** Drive the captured route. */
async function call(route, method, query = '', payload = undefined) {
  const response = makeResponse()
  await route.handler(makeRequest(method, query, payload), response)
  let json = null
  try { json = JSON.parse(response.body) } catch (error) { json = null }
  return { status: response.statusCode, json, headers: response.headers }
}

test('serves the list and one idea over GET', async () => {
  const root = await scratch()
  process.env.DSH_IDEA_ARCHIVE_DIR = root
  try {
    const { route } = mount()
    const created = await call(route, 'POST', '', JSON.stringify({
      action: 'create',
      title: 'Router idea',
      note: 'Simple project.',
      estimate: 'About 1 hour',
      links: ['OpenWrt wiki | https://openwrt.org/toh/cudy/wr1300_v3'],
    }))
    assert.equal(created.status, 200)
    const ideaId = created.json.idea.id

    const list = await call(route, 'GET')
    assert.equal(list.status, 200)
    assert.equal(list.json.ideas.length, 1)
    assert.equal(list.json.ideas[0].title, 'Router idea')
    assert.ok(list.json.storage.endsWith('idea-archive') || list.json.storage.includes('idea-archive'))

    const detail = await call(route, 'GET', `?view=idea&id=${ideaId}`)
    assert.equal(detail.status, 200)
    assert.equal(detail.json.idea.links.length, 1)
    assert.deepEqual(detail.json.logs, [])

    const empty = await call(route, 'GET', '?view=idea&id=idea_missing000')
    assert.equal(empty.status, 400)
    assert.match(empty.json.error, /No idea/u)
  } finally {
    delete process.env.DSH_IDEA_ARCHIVE_DIR
    await rm(root, { recursive: true, force: true })
  }
})

test('mutations go through POST and report input errors', async () => {
  const root = await scratch()
  process.env.DSH_IDEA_ARCHIVE_DIR = root
  try {
    const { route } = mount()
    const created = await call(route, 'POST', '', JSON.stringify({ action: 'create', title: 'Router idea' }))
    const ideaId = created.json.idea.id

    const attached = await call(route, 'POST', '', JSON.stringify({
      action: 'attach-log',
      id: ideaId,
      name: 'duck.ai export',
      text: sample,
    }))
    assert.equal(attached.status, 200)
    assert.equal(attached.json.log.promptCount, 4)

    const detail = await call(route, 'GET', `?view=idea&id=${ideaId}`)
    assert.equal(detail.json.logs[0].turns.length, 8)

    const updated = await call(route, 'POST', '', JSON.stringify({ action: 'update', id: ideaId, status: 'done' }))
    assert.equal(updated.json.idea.status, 'done')

    const link = await call(route, 'POST', '', JSON.stringify({ action: 'add-link', id: ideaId, url: 'https://openwrt.org/' }))
    assert.equal(link.status, 200)
    assert.equal(link.json.idea.linkCount, 1)

    const badAction = await call(route, 'POST', '', JSON.stringify({ action: 'nope' }))
    assert.equal(badAction.status, 400)

    const badJson = await call(route, 'POST', '', '{not json')
    assert.equal(badJson.status, 400)
    assert.match(badJson.json.error, /not valid JSON/u)

    const badMethod = await call(route, 'DELETE')
    assert.equal(badMethod.status, 405)
    assert.equal(badMethod.headers.allow, 'GET, HEAD, POST')
  } finally {
    delete process.env.DSH_IDEA_ARCHIVE_DIR
    await rm(root, { recursive: true, force: true })
  }
})

test('mounts the five agent tools with the shared canonical output', () => {
  process.env.DSH_IDEA_ARCHIVE_DIR = '/tmp/idea-archive-unused'
  try {
    const { tools } = mount()
    assert.deepEqual(tools.map(tool => tool.name).sort(), [
      'idea_add_links',
      'idea_attach_log',
      'idea_get',
      'idea_list',
      'idea_save',
    ])
    for (const tool of tools) {
      assert.equal(tool.output.schema.type, 'object')
      assert.equal(typeof tool.output.render, 'function')
      assert.equal(typeof tool.execute, 'function')
      assert.ok(tool.description.length > 40)
    }
  } finally {
    delete process.env.DSH_IDEA_ARCHIVE_DIR
  }
})

test('client bundle follows the module-loader contract', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const client = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(typeof manifest.exports['./client'], 'string')
  assert.ok(client.includes('window.__ModuleLoader__.load('))
  assert.ok(client.includes(`id: '${manifest.name}'`), 'the bundle id is the package name')
  assert.ok(client.includes('factory(require)'))
  assert.ok(client.includes("require('react')"))
  assert.ok(!/require\('@deepseek-ai\//u.test(client), 'no Harness Client package is required')
  assert.ok(client.includes("ctx.slots.inject('main'"), 'registers the main panel')
  assert.ok(client.includes("ctx.slots.inject('sidebar.panellist'"), 'registers the sidebar entry')
  for (const token of ['--dsw-alias-bg-base', '--dsw-alias-label-primary', '--dsw-alias-border-l1']) {
    assert.ok(client.includes(token), `uses theme token ${token}`)
  }
})

test('display resources are valid', async () => {
  const en = JSON.parse(await readFile(new URL('../locale/en.json', import.meta.url), 'utf8'))
  const zh = JSON.parse(await readFile(new URL('../locale/zh.json', import.meta.url), 'utf8'))
  assert.equal(en.meta.title, 'Idea archive')
  assert.ok(en.meta.description.length > 80)
  assert.equal(en.meta.detail, 'docs/DETAIL.md')
  assert.equal(zh.meta.title, '想法归档')

  const icon = await readFile(new URL('../icon.svg', import.meta.url), 'utf8')
  assert.match(icon, /viewBox="0 0 36 36"/u)
  assert.ok(!/<text|<script|foreignObject/u.test(icon))

  const detail = await readFile(new URL('../docs/DETAIL.md', import.meta.url), 'utf8')
  assert.match(detail, /^!\[[^\]]+\]\(preview\.svg\)\s*$/u)
  const preview = await readFile(new URL('../docs/preview.svg', import.meta.url), 'utf8')
  assert.match(preview, /viewBox="0 0 640 300"/u)
  assert.ok(!/<text|<script|foreignObject/u.test(preview))
})

test('exports a whole archive and imports it into a fresh archive', async () => {
  const source = await scratch()
  const target = await scratch()
  process.env.DSH_IDEA_ARCHIVE_DIR = source
  try {
    const original = mount()
    const created = await call(original.route, 'POST', '', JSON.stringify({
      action: 'create',
      title: 'Router idea',
      note: 'Simple project.',
      estimate: 'About 1 hour',
      links: ['OpenWrt wiki | https://openwrt.org/toh/cudy/wr1300_v3'],
    }))
    const ideaId = created.json.idea.id
    await call(original.route, 'POST', '', JSON.stringify({
      action: 'attach-log', id: ideaId, name: 'duck.ai export', text: sample,
    }))

    const exported = await call(original.route, 'GET', '?view=export')
    assert.equal(exported.status, 200)
    assert.equal(exported.json.format, 'dsh-idea-archive')
    assert.equal(exported.json.ideas.length, 1)
    assert.equal(exported.json.ideas[0].title, 'Router idea')
    assert.equal(exported.json.ideas[0].links.length, 1)
    assert.equal(exported.json.ideas[0].logs.length, 1)
    assert.match(exported.json.ideas[0].logs[0].text, /generated with Duck\.ai/u)

    // A fresh instance: same plugin, empty archive, import the file.
    process.env.DSH_IDEA_ARCHIVE_DIR = target
    const fresh = mount()
    const imported = await call(fresh.route, 'POST', '', JSON.stringify({
      action: 'import', archive: exported.json,
    }))
    assert.equal(imported.status, 200)
    assert.deepEqual(imported.json, { ok: true, imported: 1, skipped: 0, invalid: 0, logs: 1 })

    const list = await call(fresh.route, 'GET')
    assert.equal(list.json.ideas.length, 1)
    assert.equal(list.json.ideas[0].linkCount, 1)
    assert.equal(list.json.ideas[0].logCount, 1)

    const detail = await call(fresh.route, 'GET', `?view=idea&id=${list.json.ideas[0].id}`)
    assert.equal(detail.json.idea.note, 'Simple project.')
    assert.equal(detail.json.idea.estimate, 'About 1 hour')
    assert.equal(detail.json.logs[0].turns.length, 8)

    // Importing the same file again merges without duplicating.
    const again = await call(fresh.route, 'POST', '', JSON.stringify({
      action: 'import', archive: exported.json,
    }))
    assert.deepEqual(again.json, { ok: true, imported: 0, skipped: 1, invalid: 0, logs: 0 })
    assert.equal((await call(fresh.route, 'GET')).json.ideas.length, 1)
  } finally {
    delete process.env.DSH_IDEA_ARCHIVE_DIR
    await rm(source, { recursive: true, force: true })
    await rm(target, { recursive: true, force: true })
  }
})

test('rejects a file that is not an idea archive export', async () => {
  const root = await scratch()
  process.env.DSH_IDEA_ARCHIVE_DIR = root
  try {
    const { route } = mount()
    const wrong = await call(route, 'POST', '', JSON.stringify({ action: 'import', archive: { hello: 'world' } }))
    assert.equal(wrong.status, 400)
    assert.match(wrong.json.error, /not an Idea archive export/u)

    const malformed = await call(route, 'POST', '', JSON.stringify({
      action: 'import',
      archive: { format: 'dsh-idea-archive', ideas: [{ title: '' }, null, { title: 'Kept' }] },
    }))
    assert.equal(malformed.status, 200)
    assert.equal(malformed.json.imported, 1)
    assert.equal(malformed.json.invalid, 2)
  } finally {
    delete process.env.DSH_IDEA_ARCHIVE_DIR
    await rm(root, { recursive: true, force: true })
  }
})
