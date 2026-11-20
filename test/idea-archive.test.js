/**
 * Unit tests for the idea archive Host half: the duck.ai transcript parser and
 * the durable store (index, links, and attached log files).
 */

import assert from 'node:assert/strict'
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { IdeaStore, parseTranscript } from '../index.js'

const fixture = new URL('./fixtures/openwrt-duckai.txt', import.meta.url)
const sample = await readFile(fixture, 'utf8')

/** @returns {Promise<string>} a fresh archive directory. */
async function scratch() {
  return mkdtemp(join(tmpdir(), 'idea-archive-test-'))
}

test('parses the duck.ai export into questions and answers', () => {
  const parsed = parseTranscript(sample)
  assert.equal(parsed.kind, 'duck.ai')
  assert.equal(parsed.model, "OpenAI's GPT-6 Luna")
  assert.equal(parsed.promptCount, 4)
  assert.equal(parsed.turns.length, 8)
  assert.equal(parsed.turns[0].role, 'user')
  assert.match(parsed.turns[0].text, /openwrt\.org\/toh\/cudy\/wr1300_v3/u)
  assert.equal(parsed.turns[0].at, '11/20/2026, 11:23:56 AM')
  assert.equal(parsed.turns[1].role, 'assistant')
  assert.equal(parsed.turns[1].label, 'GPT-6 Luna')
  assert.match(parsed.turns[1].text, /^\*\*Pros\*\*/u)
  assert.equal(parsed.turns[2].role, 'user')
  assert.match(parsed.turns[2].text, /garage/u)
  assert.match(parsed.turns[7].text, /network-wide blocklist/u)
})

test('treats an unrecognized text file as one raw transcript', () => {
  const parsed = parseTranscript('Just some notes about a router.\nNothing structured here.')
  assert.equal(parsed.kind, 'text')
  assert.equal(parsed.promptCount, 0)
  assert.deepEqual(parsed.turns, [])
})

test('creates, lists, updates, and filters ideas', async () => {
  const root = await scratch()
  try {
    const store = new IdeaStore(root)
    const { idea } = await store.create({
      title: 'Install OpenWrt on the router',
      note: 'This seems doable. I estimate about an hour.',
      estimate: 'About 1 hour',
      links: ['OpenWrt wiki — WR1300 v3 | https://openwrt.org/toh/cudy/wr1300_v3'],
    })
    assert.match(idea.id, /^idea_/u)
    assert.equal(idea.status, 'idea')
    assert.equal(idea.links.length, 1)
    assert.equal(idea.links[0].title, 'OpenWrt wiki — WR1300 v3')

    const listed = await store.list()
    assert.equal(listed.length, 1)
    assert.equal(listed[0].title, 'Install OpenWrt on the router')
    assert.equal(listed[0].logCount, 0)

    const updated = await store.update(idea.id, { status: 'doing', estimate: '30 minutes' })
    assert.equal(updated.idea.status, 'doing')
    assert.equal(updated.idea.estimate, '30 minutes')
    assert.equal(updated.idea.title, 'Install OpenWrt on the router')

    const links = await store.addLinks(idea.id, [
      'https://openwrt.org/toh/cudy/wr1300_v3',
      'https://openwrt.org/toh/cudy/cudy_wr1300_v2',
    ])
    assert.equal(links.added, 1)
    assert.equal(links.idea.links.length, 2)

    await assert.rejects(() => store.update(idea.id, { title: '   ' }), /title cannot be empty/u)
    await assert.rejects(() => store.addLinks(idea.id, ['not a url']), /http\(s\)/u)
    await assert.rejects(() => store.update('idea_missing000', { note: 'x' }), /No idea/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('persists an attached transcript and parses it on read', async () => {
  const root = await scratch()
  try {
    const store = new IdeaStore(root)
    const { idea } = await store.create({ title: 'Router idea' })
    const { log } = await store.attachLog(idea.id, { name: 'duck.ai export', text: sample })
    assert.match(log.id, /^log_/u)
    assert.equal(log.kind, 'duck.ai')
    assert.equal(log.promptCount, 4)
    assert.ok(log.size > 9_000)

    const file = join(root, 'logs', idea.id, log.file)
    assert.equal((await stat(file)).isFile(), true)

    const reopened = new IdeaStore(root)
    const detail = await reopened.detail(idea.id)
    assert.equal(detail.idea.logs.length, 1)
    assert.equal(detail.logs[0].turns.length, 8)
    assert.equal(detail.logs[0].missing, false)

    await reopened.removeLog(idea.id, log.id)
    const after = await reopened.detail(idea.id)
    assert.equal(after.idea.logs.length, 0)
    await assert.rejects(() => stat(file), /ENOENT/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('keeps the archive readable when the index has a broken entry', async () => {
  const root = await scratch()
  try {
    await writeFile(join(root, 'ideas.json'), JSON.stringify({
      version: 1,
      ideas: [
        { id: 'idea_aaaaaaaaaaaa', title: 'Valid idea', links: [{ url: 'https://example.com/', title: '' }] },
        { id: 'idea_bbbbbbbbbbbb', title: '   ' },
        { id: 'idea_cccccccccccc', title: 'Bad links', links: [{ url: 'ftp://example.com' }] },
      ],
    }), 'utf8')
    const store = new IdeaStore(root)
    const ideas = await store.list()
    assert.deepEqual(ideas.map(idea => idea.title).sort(), ['Bad links', 'Valid idea'])
    assert.equal(ideas.find(idea => idea.title === 'Bad links').links.length, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('deletes an idea together with its saved transcripts', async () => {
  const root = await scratch()
  try {
    const store = new IdeaStore(root)
    const { idea } = await store.create({ title: 'Disposable' })
    const { log } = await store.attachLog(idea.id, { text: sample })
    const directory = join(root, 'logs', idea.id)
    await store.deleteIdea(idea.id)
    assert.equal((await store.list()).length, 0)
    await assert.rejects(() => stat(join(directory, log.file)), /ENOENT/u)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects an oversized transcript', async () => {
  const root = await scratch()
  try {
    const store = new IdeaStore(root)
    const { idea } = await store.create({ title: 'Big log' })
    await assert.rejects(
      () => store.attachLog(idea.id, { text: 'x'.repeat(4 * 1024 * 1024 + 1) }),
      /4 MiB/u,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
