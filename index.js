/**
 * Idea archive.
 *
 * Keeps a durable list of projects the user explored for a few minutes and
 * wants to come back to. Each idea carries the user's own thought and time
 * estimate, the research links they collected, and the chat logs they saved
 * (for example a duck.ai export) as transcript files.
 *
 * The agent reaches the archive through five tools; the user reaches it
 * through the **Idea archive** page in the main column (client.js), which
 * talks to this Host half over one small JSON route. The archive lives under
 * `$DSH_HOME/idea-archive`: `ideas.json` plus one text file per attached log,
 * so it survives restarts and removing and reinstalling this bundle.
 *
 * @module idea-archive
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

export const name = 'idea-archive'
export const inject = ['tools']

/** Bump only when the stored shape or its meaning changes. */
const STATE_VERSION = 1
/** Idea lifecycle, in the order the page shows its filters. */
const STATUSES = ['idea', 'doing', 'done']
/** Per-field ceilings; oversized input is rejected rather than silently cut. */
const MAX_TITLE = 200
const MAX_NOTE = 20_000
const MAX_ESTIMATE = 200
const MAX_URL = 2_000
const MAX_LINK_TITLE = 300
const MAX_LOG_NAME = 200
const MAX_LOG_TEXT = 4 * 1024 * 1024
/** Generous enough for a 4 MiB transcript plus JSON escaping. */
const MAX_BODY_BYTES = MAX_LOG_TEXT + 1024 * 1024
/** How much of the transcript the agent tool sends back. */
const MAX_TOOL_LOG_CHARS = 24_000
/** Browser endpoint for both reads and mutations. */
const API_ROUTE = '/idea-archive/api'

const IDEA_ID = /^idea_[a-z0-9]{6,32}$/
const LOG_ID = /^log_[a-z0-9]{6,32}$/
const LOG_FILE = /^log_[a-z0-9]{6,32}\.txt$/

/** A rejected input, reported as 400 by the route and as an error by a tool. */
class ArchiveError extends Error {
  /** @param {string} message user-facing reason. */
  constructor(message) {
    super(message)
    this.name = 'ArchiveError'
  }
}

/** @param {string} prefix id family. @returns {string} a fresh short id. */
function newId(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 12)}`
}

/** @returns {string} the current instant. */
function nowIso() {
  return new Date().toISOString()
}

/**
 * Resolve the archive directory. `DSH_IDEA_ARCHIVE_DIR` exists for tests and
 * for keeping the archive somewhere else; otherwise it lives beside other DSH
 * data, not inside one workspace, so every session shares one archive.
 * @returns {string} absolute archive directory.
 */
export function resolveArchiveRoot() {
  if (process.env.DSH_IDEA_ARCHIVE_DIR) return process.env.DSH_IDEA_ARCHIVE_DIR
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'idea-archive')
}

/** @returns {{version: number, ideas: object[]}} an empty archive. */
function emptyState() {
  return { version: STATE_VERSION, ideas: [] }
}

/** @param {unknown} raw parsed JSON. @returns {string} a validated status. */
function normalizeStatus(raw) {
  return typeof raw === 'string' && STATUSES.includes(raw) ? raw : 'idea'
}

/** @param {unknown} raw a timestamp. @returns {string} a valid ISO timestamp or the epoch. */
function normalizeTime(raw) {
  if (typeof raw !== 'string') return new Date(0).toISOString()
  const time = Date.parse(raw)
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date(0).toISOString()
}

/** @param {unknown} raw a candidate URL. @returns {string} the normalized URL, or ''. */
function normalizeUrl(raw) {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.length > MAX_URL) return ''
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch (error) {
    return ''
  }
}

/**
 * Accept only link records this plugin can render, dropping malformed ones
 * rather than making the whole archive unreadable.
 * @param {unknown} raw candidate link.
 * @returns {{id: string, url: string, title: string, addedAt: string} | undefined} the link.
 */
function normalizeLink(raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  const url = normalizeUrl(raw.url)
  if (url === '') return undefined
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_LINK_TITLE) : ''
  const id = typeof raw.id === 'string' && /^link_[a-z0-9]{6,32}$/.test(raw.id) ? raw.id : newId('link')
  return { id, url, title, addedAt: normalizeTime(raw.addedAt) }
}

/**
 * Accept only log metadata whose file name this plugin could have written.
 * The text itself is never part of the index; it stays in its own file.
 * @param {unknown} raw candidate log.
 * @returns {object | undefined} the log metadata.
 */
function normalizeLog(raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  if (typeof raw.file !== 'string' || !LOG_FILE.test(raw.file)) return undefined
  if (typeof raw.id !== 'string' || !LOG_ID.test(raw.id)) return undefined
  const name = typeof raw.name === 'string' && raw.name.trim() !== ''
    ? raw.name.trim().slice(0, MAX_LOG_NAME)
    : 'Chat log'
  return {
    id: raw.id,
    name,
    file: raw.file,
    kind: raw.kind === 'duck.ai' ? 'duck.ai' : 'text',
    model: typeof raw.model === 'string' ? raw.model.slice(0, 120) : '',
    promptCount: Number.isInteger(raw.promptCount) && raw.promptCount >= 0 ? raw.promptCount : 0,
    size: Number.isInteger(raw.size) && raw.size >= 0 ? raw.size : 0,
    addedAt: normalizeTime(raw.addedAt),
  }
}

/**
 * Normalize one stored idea, or reject it when it has no usable title.
 * @param {unknown} raw candidate idea.
 * @returns {object | undefined} the idea.
 */
function normalizeIdea(raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_TITLE) : ''
  if (title === '') return undefined
  const id = typeof raw.id === 'string' && IDEA_ID.test(raw.id) ? raw.id : newId('idea')
  const links = Array.isArray(raw.links) ? raw.links.map(normalizeLink).filter(Boolean) : []
  const logs = Array.isArray(raw.logs) ? raw.logs.map(normalizeLog).filter(Boolean) : []
  const createdAt = normalizeTime(raw.createdAt)
  return {
    id,
    title,
    note: typeof raw.note === 'string' ? raw.note.slice(0, MAX_NOTE) : '',
    estimate: typeof raw.estimate === 'string' ? raw.estimate.slice(0, MAX_ESTIMATE) : '',
    status: normalizeStatus(raw.status),
    links,
    logs,
    createdAt,
    updatedAt: normalizeTime(raw.updatedAt ?? createdAt),
  }
}

/**
 * Read the index, treating a missing file as empty. A file that is not valid
 * JSON is moved aside so one interrupted write cannot make the archive
 * unreadable; the returned notice tells the user where the old file went.
 * @param {string} file absolute index path.
 * @returns {Promise<{state: {version: number, ideas: object[]}, notice: string}>} the archive.
 */
async function readState(file) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return { state: emptyState(), notice: '' }
    throw error
  }
  try {
    const parsed = JSON.parse(text)
    const state = emptyState()
    if (parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.ideas)) {
      state.ideas = parsed.ideas.map(normalizeIdea).filter(Boolean)
    }
    return { state, notice: '' }
  } catch (error) {
    const backup = `${file}.corrupt-${Date.now()}`
    await rename(file, backup).catch(() => {})
    console.warn(`[idea-archive] Unreadable archive moved to ${backup}: ${error?.message ?? error}`)
    return {
      state: emptyState(),
      notice: `The previous archive index was unreadable and was saved as ${backup}; the list restarted empty.`,
    }
  }
}

/**
 * Publish one index atomically: write a sibling temp file, then rename it.
 * @param {string} file absolute index path.
 * @param {{version: number, ideas: object[]}} state archive to save.
 */
async function saveState(file, state) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const temporary = join(dirname(file), `.${process.pid}-${randomUUID()}.tmp`)
  const document = JSON.stringify({ version: STATE_VERSION, ideas: state.ideas }, null, 2)
  await writeFile(temporary, `${document}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, file)
}

/**
 * Parse a saved conversation export into turns.
 *
 * The duck.ai export marks each question with `User prompt N of M - <time>:`
 * and the answer with a short model line such as `GPT-6 Luna:`; a run of
 * dashes separates exchanges. Anything else is reported as a plain text log
 * and shown verbatim.
 * @param {string} text the saved conversation file.
 * @returns {{kind: 'duck.ai' | 'text', model: string, promptCount: number, turns: object[]}} the transcript.
 */
export function parseTranscript(text) {
  const source = typeof text === 'string' ? text.replace(/\r\n/g, '\n') : ''
  const preamble = source.slice(0, 2_000)
  const fromDuck = /generated with Duck\.ai/iu.test(preamble)
  const model = (preamble.match(/using (.+?) Model/iu)?.[1] ?? '').trim()
  // The answer header repeats the model without the vendor prefix.
  const headerModel = model.replace(/^.*?'s\s+/u, '').trim()
  const turns = []
  const blocks = source.split(/\n-{10,}\n/u)
  for (const block of blocks) {
    const lines = block.split('\n')
    const promptIndex = lines.findIndex(line => /^User prompt \d+ of \d+ - .+:$/u.test(line.trim()))
    if (promptIndex < 0) continue
    const header = lines[promptIndex].trim().match(/^User prompt (\d+) of \d+ - (.+):$/u)
    const at = header === null ? '' : header[2].trim()
    let answerIndex = -1
    for (let index = promptIndex + 1; index < lines.length - 1; index += 1) {
      if (lines[index].trim() !== '') continue
      const candidate = lines[index + 1].trim()
      if (!candidate.endsWith(':') || candidate.length > 60) continue
      const label = candidate.slice(0, -1).trim()
      if (headerModel !== '' && label === headerModel) {
        answerIndex = index + 1
        break
      }
      if (/^(?:GPT|Claude|Llama|Mistral|Gemini|ChatGPT|DeepSeek|copilot|o\d)[\w .\-()]{0,40}$/iu.test(label)) {
        answerIndex = index + 1
        break
      }
    }
    const userEnd = answerIndex < 0 ? lines.length : answerIndex
    const userText = lines.slice(promptIndex + 1, userEnd).join('\n').trim()
    const label = answerIndex < 0 ? '' : lines[answerIndex].trim().slice(0, -1).trim()
    const answerText = answerIndex < 0 ? '' : lines.slice(answerIndex + 1).join('\n').trim()
    if (userText !== '') turns.push({ role: 'user', label: '', at, text: userText })
    if (answerText !== '') turns.push({ role: 'assistant', label: label || model || 'Assistant', at: '', text: answerText })
  }
  return {
    kind: fromDuck || turns.length > 0 ? 'duck.ai' : 'text',
    model,
    promptCount: turns.filter(turn => turn.role === 'user').length,
    turns,
  }
}

/** @param {object} idea stored idea. @returns {object} the list projection. */
function summaryOf(idea) {
  return {
    id: idea.id,
    title: idea.title,
    status: idea.status,
    note: idea.note,
    estimate: idea.estimate,
    links: idea.links.map(link => ({ ...link })),
    linkCount: idea.links.length,
    logCount: idea.logs.length,
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt,
  }
}

/** @param {object} idea stored idea. @returns {object} a detached copy. */
function publicIdea(idea) {
  return {
    ...summaryOf(idea),
    logs: idea.logs.map(log => ({ ...log })),
  }
}

/** @param {object} idea stored idea. @param {object} log log metadata. @returns {string} absolute transcript path. */
function logPath(idea, log) {
  return join(logPathRoot(idea), log.file)
}

/** @param {object} idea stored idea. @returns {string} the idea's log directory. */
function logPathRoot(idea) {
  return join(idea.root, 'logs', idea.id)
}

/** @param {string} value free text. @param {number} max ceiling. @param {string} field label. @returns {string} trimmed text. */
function readText(value, max, field) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new ArchiveError(`${field} must be text.`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new ArchiveError(`${field} is longer than ${max} characters.`)
  return trimmed
}

/** @param {unknown} value requested status. @returns {string} a valid status. */
function readStatus(value) {
  if (value === undefined || value === null || value === '') return 'idea'
  if (typeof value !== 'string' || !STATUSES.includes(value)) {
    throw new ArchiveError(`status must be one of ${STATUSES.join(', ')}.`)
  }
  return value
}

/**
 * Read one link from either a URL string, `Label | URL`, or a link object.
 * @param {unknown} raw candidate link.
 * @returns {{url: string, title: string}} the cleaned link.
 */
function readLink(raw) {
  let url = ''
  let title = ''
  if (typeof raw === 'string') {
    const text = raw.trim()
    const separator = text.indexOf('|')
    if (separator >= 0) {
      title = text.slice(0, separator).trim()
      url = text.slice(separator + 1).trim()
    } else {
      url = text
    }
  } else if (raw !== null && typeof raw === 'object') {
    url = typeof raw.url === 'string' ? raw.url : ''
    title = typeof raw.title === 'string' ? raw.title : ''
  }
  const normalized = normalizeUrl(url)
  if (normalized === '') throw new ArchiveError(`Not an http(s) link: ${String(url).slice(0, 120)}`)
  return { url: normalized, title: title.slice(0, MAX_LINK_TITLE) }
}

/** @param {unknown} raw links input. @returns {{url: string, title: string}[]} cleaned links. */
function readLinks(raw) {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw new ArchiveError('links must be an array.')
  return raw.map(readLink)
}

/** @param {object} idea stored idea. @returns {string} Markdown that reproduces the archive entry. */
function ideaMarkdown(idea) {
  const lines = [`# ${idea.title}`, '']
  lines.push(`Status: ${idea.status}${idea.estimate === '' ? '' : ` · Estimate: ${idea.estimate}`}`)
  lines.push(`Saved: ${idea.createdAt} · Updated: ${idea.updatedAt}`, '')
  if (idea.note !== '') lines.push('## My thought', '', idea.note, '')
  lines.push('## Research links', '')
  if (idea.links.length === 0) lines.push('_No links saved yet._')
  for (const link of idea.links) {
    lines.push(`- ${link.title === '' ? link.url : `[${link.title}](${link.url})`}`)
    if (link.title !== '') lines.push(`  ${link.url}`)
  }
  lines.push('')
  lines.push('## Saved research', '')
  if (idea.logs.length === 0) lines.push('_No chat logs attached yet._')
  for (const log of idea.logs) lines.push(`- ${log.name} (${log.kind}, ${log.promptCount} prompts, saved ${log.addedAt})`)
  lines.push('')
  lines.push(`Idea id: ${idea.id}`)
  return lines.join('\n')
}

/**
 * One serialized archive. Reads wait for the write chain so a status call
 * cannot report a half-applied change.
 */
export class IdeaStore {
  /** @param {string} root absolute archive directory. */
  constructor(root) {
    this.root = root
    this.file = join(root, 'ideas.json')
    /** @type {{version: number, ideas: object[]} | null} */
    this.state = null
    /** @type {Promise<{state: {version: number, ideas: object[]}, notice: string}> | undefined} */
    this.loading = undefined
    /** Recovery notice waiting for the next result. */
    this.pendingNotice = ''
    /** Tail of the write chain; never rejects. */
    this.tail = Promise.resolve()
  }

  /** @returns {Promise<{version: number, ideas: object[]}>} the cached or loaded archive. */
  async load() {
    if (this.state !== null) return this.state
    if (this.loading === undefined) this.loading = readState(this.file)
    try {
      const loaded = await this.loading
      this.state = loaded.state
      if (loaded.notice !== '') this.pendingNotice = loaded.notice
    } finally {
      this.loading = undefined
    }
    return this.state
  }

  /** @returns {string} the pending recovery notice, reported once. */
  takeNotice() {
    const notice = this.pendingNotice
    this.pendingNotice = ''
    return notice
  }

  /**
   * Run one mutation and publish it before resolving.
   * @param {(draft: {version: number, ideas: object[]}) => Promise<object> | object} work mutates the draft.
   * @returns {Promise<object>} whatever `work` returned.
   */
  run(work) {
    const operation = this.tail.then(async () => {
      const current = await this.load()
      const draft = {
        version: STATE_VERSION,
        ideas: current.ideas.map(idea => normalizeIdea(idea)).filter(Boolean),
      }
      const result = await work(draft)
      await saveState(this.file, draft)
      this.state = draft
      return result
    })
    this.tail = operation.then(() => undefined, () => undefined)
    return operation
  }

  /**
   * Find one idea in a draft.
   * @param {{ideas: object[]}} draft working archive.
   * @param {string} id idea id.
   * @returns {object} the idea.
   */
  static find(draft, id) {
    const idea = draft.ideas.find(candidate => candidate.id === id)
    if (idea === undefined) throw new ArchiveError(`No idea with id ${id}.`)
    return idea
  }

  /** @returns {Promise<{ideas: object[], notice: string}>} all ideas, newest update first. */
  async overview() {
    await this.tail
    const state = await this.load()
    const ideas = state.ideas
      .map(summaryOf)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    return { ideas, notice: this.takeNotice() }
  }

  /** @returns {Promise<object[]>} all ideas as summaries, newest update first. */
  async list() {
    return (await this.overview()).ideas
  }

  /**
   * One idea with every attached transcript parsed for display.
   * @param {string} id idea id.
   * @returns {Promise<{idea: object, logs: object[]}>} the detail view.
   */
  async detail(id) {
    await this.tail
    const state = await this.load()
    const idea = state.ideas.find(candidate => candidate.id === id)
    if (idea === undefined) throw new ArchiveError(`No idea with id ${id}.`)
    const logs = []
    for (const log of idea.logs) {
      let text = ''
      try {
        text = await readFile(logPath({ ...idea, root: this.root }, log), 'utf8')
      } catch (error) {
        if (error?.code !== 'ENOENT') console.warn(`[idea-archive] Cannot read ${log.file}: ${error?.message ?? error}`)
      }
      const parsed = parseTranscript(text)
      logs.push({
        ...log,
        turns: parsed.turns,
        // Raw text is a fallback only: a parsed transcript already carries it.
        raw: parsed.turns.length === 0 ? text.slice(0, 200_000) : '',
        missing: text === '',
      })
    }
    return { idea: publicIdea(idea), logs, notice: this.takeNotice() }
  }

  /**
   * Create one idea.
   * @param {{title?: unknown, note?: unknown, estimate?: unknown, status?: unknown, links?: unknown}} input fields.
   * @returns {Promise<{idea: object}>} the created idea.
   */
  async create(input) {
    const title = readText(input?.title, MAX_TITLE, 'title')
    if (title === '') throw new ArchiveError('title is required.')
    const note = readText(input?.note, MAX_NOTE, 'note')
    const estimate = readText(input?.estimate, MAX_ESTIMATE, 'estimate')
    const status = readStatus(input?.status)
    const links = readLinks(input?.links)
    return this.run(draft => {
      const at = nowIso()
      const idea = {
        id: newId('idea'),
        title,
        note,
        estimate,
        status,
        links: links.map(link => ({ id: newId('link'), url: link.url, title: link.title, addedAt: at })),
        logs: [],
        createdAt: at,
        updatedAt: at,
      }
      draft.ideas.unshift(idea)
      return { idea: publicIdea(idea) }
    })
  }

  /**
   * Change one idea's own fields. Omitted fields keep their value.
   * @param {string} id idea id.
   * @param {{title?: unknown, note?: unknown, estimate?: unknown, status?: unknown}} patch fields.
   * @returns {Promise<{idea: object}>} the updated idea.
   */
  update(id, patch) {
    return this.run(draft => {
      const idea = IdeaStore.find(draft, id)
      if (patch?.title !== undefined) {
        const title = readText(patch.title, MAX_TITLE, 'title')
        if (title === '') throw new ArchiveError('title cannot be empty.')
        idea.title = title
      }
      if (patch?.note !== undefined) idea.note = readText(patch.note, MAX_NOTE, 'note')
      if (patch?.estimate !== undefined) idea.estimate = readText(patch.estimate, MAX_ESTIMATE, 'estimate')
      if (patch?.status !== undefined) idea.status = readStatus(patch.status)
      idea.updatedAt = nowIso()
      return { idea: publicIdea(idea) }
    })
  }

  /**
   * Append research links, skipping URLs the idea already has.
   * @param {string} id idea id.
   * @param {unknown} links `URL` or `Label | URL` strings, or link objects.
   * @returns {Promise<{idea: object, added: number}>} the updated idea.
   */
  async addLinks(id, links) {
    const cleaned = readLinks(links)
    return this.run(draft => {
      const idea = IdeaStore.find(draft, id)
      const known = new Set(idea.links.map(link => link.url))
      let added = 0
      for (const link of cleaned) {
        if (known.has(link.url)) continue
        known.add(link.url)
        idea.links.push({ id: newId('link'), url: link.url, title: link.title, addedAt: nowIso() })
        added += 1
      }
      if (added > 0) idea.updatedAt = nowIso()
      return { idea: publicIdea(idea), added }
    })
  }

  /**
   * Remove one link.
   * @param {string} id idea id.
   * @param {string} linkId link id.
   * @returns {Promise<{idea: object}>} the updated idea.
   */
  removeLink(id, linkId) {
    return this.run(draft => {
      const idea = IdeaStore.find(draft, id)
      const before = idea.links.length
      idea.links = idea.links.filter(link => link.id !== linkId)
      if (idea.links.length === before) throw new ArchiveError('That link is not on this idea.')
      idea.updatedAt = nowIso()
      return { idea: publicIdea(idea) }
    })
  }

  /**
   * Save one transcript file beside the index and record it on the idea.
   * @param {string} id idea id.
   * @param {{name?: unknown, text?: unknown}} input file name and contents.
   * @returns {Promise<{idea: object, log: object}>} the updated idea and new log.
   */
  async attachLog(id, input) {
    const text = typeof input?.text === 'string' ? input.text : ''
    if (text.trim() === '') throw new ArchiveError('The chat log is empty.')
    if (Buffer.byteLength(text) > MAX_LOG_TEXT) throw new ArchiveError('The chat log is larger than 4 MiB.')
    const name = readText(input?.name, MAX_LOG_NAME, 'name') || 'Chat log'
    return this.run(async draft => {
      const idea = IdeaStore.find(draft, id)
      const parsed = parseTranscript(text)
      const logId = newId('log')
      const log = {
        id: logId,
        name,
        file: `${logId}.txt`,
        kind: parsed.kind,
        model: parsed.model.slice(0, 120),
        promptCount: parsed.promptCount,
        size: Buffer.byteLength(text),
        addedAt: nowIso(),
      }
      const directory = join(this.root, 'logs', idea.id)
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await writeFile(join(directory, log.file), text, { encoding: 'utf8', mode: 0o600 })
      idea.logs.push(log)
      idea.updatedAt = nowIso()
      return { idea: publicIdea(idea), log }
    })
  }

  /**
   * Remove one transcript and its file.
   * @param {string} id idea id.
   * @param {string} logId log id.
   * @returns {Promise<{idea: object}>} the updated idea.
   */
  removeLog(id, logId) {
    return this.run(async draft => {
      const idea = IdeaStore.find(draft, id)
      const log = idea.logs.find(candidate => candidate.id === logId)
      if (log === undefined) throw new ArchiveError('That chat log is not on this idea.')
      idea.logs = idea.logs.filter(candidate => candidate.id !== logId)
      idea.updatedAt = nowIso()
      await rm(logPath({ ...idea, root: this.root }, log), { force: true })
      return { idea: publicIdea(idea) }
    })
  }

  /**
   * Delete one idea and every transcript saved for it.
   * @param {string} id idea id.
   * @returns {Promise<{deleted: string}>} the removed id.
   */
  deleteIdea(id) {
    return this.run(async draft => {
      const idea = IdeaStore.find(draft, id)
      draft.ideas = draft.ideas.filter(candidate => candidate.id !== id)
      await rm(join(this.root, 'logs', idea.id), { recursive: true, force: true })
      return { deleted: id }
    })
  }

  /**
   * Dispatch one browser mutation.
   * @param {Record<string, unknown>} body action and its fields.
   * @returns {Promise<object>} the result payload.
   */
  async apply(body) {
    const action = typeof body?.action === 'string' ? body.action : ''
    const id = typeof body?.id === 'string' ? body.id : ''
    switch (action) {
      case 'create': {
        const { idea } = await this.create(body)
        return { ok: true, idea }
      }
      case 'update': {
        const { idea } = await this.update(id, body)
        return { ok: true, idea }
      }
      case 'add-link': {
        const { idea, added } = await this.addLinks(id, [{ url: body?.url, title: body?.title }])
        if (added === 0) throw new ArchiveError('That link is already on this idea.')
        return { ok: true, idea }
      }
      case 'remove-link': {
        const { idea } = await this.removeLink(id, typeof body?.linkId === 'string' ? body.linkId : '')
        return { ok: true, idea }
      }
      case 'attach-log': {
        const { idea, log } = await this.attachLog(id, { name: body?.name, text: body?.text })
        return { ok: true, idea, log }
      }
      case 'remove-log': {
        const { idea } = await this.removeLog(id, typeof body?.logId === 'string' ? body.logId : '')
        return { ok: true, idea }
      }
      case 'delete': {
        return { ok: true, ...(await this.deleteIdea(id)) }
      }
      default:
        throw new ArchiveError(`Unknown action "${action}".`)
    }
  }
}

/** @param {unknown} error thrown value. @returns {string} a user-facing message. */
function messageOf(error) {
  if (error instanceof ArchiveError) return error.message
  if (error instanceof Error && error.message !== '') return error.message
  return 'The idea archive could not complete that request.'
}

/**
 * Answer one JSON exchange. Reads use GET, mutations use POST.
 * @param {IdeaStore} store shared archive.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} the route handler.
 */
function createHandler(store) {
  return async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (req.method === 'GET' || req.method === 'HEAD') {
        const view = url.searchParams.get('view') ?? 'list'
        const payload = view === 'idea'
          ? await store.detail(url.searchParams.get('id') ?? '')
          : { ...(await store.overview()), storage: store.root }
        sendJson(res, 200, payload, req.method === 'HEAD')
        return
      }
      if (req.method === 'POST') {
        const body = await readJsonBody(req)
        sendJson(res, 200, await store.apply(body))
        return
      }
      sendJson(res, 405, { error: 'Method not allowed.' }, false, { allow: 'GET, HEAD, POST' })
    } catch (error) {
      const status = error instanceof ArchiveError ? 400 : 500
      if (status === 500) console.warn(`[idea-archive] Request failed: ${error?.stack ?? error}`)
      sendJson(res, status, { error: messageOf(error) })
    }
  }
}

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} res response to end.
 * @param {number} status HTTP status.
 * @param {unknown} value JSON value.
 * @param {boolean} headOnly write headers only.
 * @param {Record<string, string>} [extra] additional headers.
 */
function sendJson(res, status, value, headOnly = false, extra = {}) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(body)),
    ...extra,
  })
  res.end(headOnly ? undefined : body)
}

/**
 * Read a POST body as JSON within the size ceiling.
 * @param {import('node:http').IncomingMessage} req request body source.
 * @returns {Promise<Record<string, unknown>>} the parsed object.
 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new ArchiveError('The request body is too large.')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ArchiveError('The request body must be a JSON object.')
    }
    return parsed
  } catch (error) {
    if (error instanceof ArchiveError) throw error
    throw new ArchiveError('The request body is not valid JSON.')
  }
}

/**
 * Build one agent tool over the shared archive. Every tool answers with the
 * same canonical shape: the model reads `text`, and the native card shows it.
 * @param {IdeaStore} store shared archive.
 * @returns {object[]} registry-ready definitions.
 */
function toolDefinitions(store) {
  /** @type {object} the shared canonical output declaration. */
  const output = {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean' },
        text: { type: 'string' },
      },
      required: ['ok', 'text'],
    },
    render(_args, value) {
      return [{ type: 'text', text: value.text }]
    },
  }

  /** @param {string} text tool text. @returns {{ok: boolean, text: string}} canonical value. */
  const answer = text => ({ ok: true, text })

  return [
    {
      name: 'idea_save',
      description:
        'Save one project idea the user wants to come back to, or update an existing one. '
        + 'Store the user\'s own thought verbatim in `note` and their time estimate in `estimate`. '
        + 'Links may be URLs or "Label | URL". Pass `id` to edit an existing idea; omit it to create a new one.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'Existing idea id to update; omit to create a new idea.' },
          title: { type: 'string', description: 'Short project name. Required when creating.' },
          note: { type: 'string', description: 'The user\'s own thought about the project, including their estimate if they gave one.' },
          estimate: { type: 'string', description: 'Time estimate, for example "About 1 hour".' },
          status: { type: 'string', enum: STATUSES, description: 'idea (not started), doing (in progress), or done.' },
          links: {
            type: 'array',
            items: { type: 'string' },
            description: 'Research links to keep with the idea, as URLs or "Label | URL". Only used when creating.',
          },
        },
      },
      output,
      async execute(args) {
        const id = typeof args?.id === 'string' ? args.id.trim() : ''
        if (id !== '') {
          const { idea } = await store.update(id, args)
          return answer(`Updated idea "${idea.title}" (${idea.id}). ${idea.linkCount} links, ${idea.logCount} logs.`)
        }
        const { idea } = await store.create(args)
        return answer(`Saved idea "${idea.title}" (${idea.id}) with ${idea.linkCount} links. Use idea_attach_log to add a chat log.`)
      },
    },
    {
      name: 'idea_list',
      description:
        'List archived project ideas, newest first. Filter by status (idea, doing, done) or a search string '
        + 'that matches the title, note, or link URLs. Use this to remind the user what they saved.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: STATUSES, description: 'Only ideas in this state.' },
          query: { type: 'string', description: 'Case-insensitive text to match against title, note, or links.' },
        },
      },
      output,
      async execute(args) {
        const status = typeof args?.status === 'string' && STATUSES.includes(args.status) ? args.status : ''
        const query = typeof args?.query === 'string' ? args.query.trim().toLowerCase() : ''
        let ideas = await store.list()
        if (status !== '') ideas = ideas.filter(idea => idea.status === status)
        if (query !== '') {
          ideas = ideas.filter(idea => {
            const haystack = [idea.title, idea.note, ...idea.links?.map(link => `${link.title} ${link.url}`) ?? []]
              .join('\n')
              .toLowerCase()
            return haystack.includes(query)
          })
        }
        if (ideas.length === 0) return answer('No archived ideas match.')
        const lines = ideas.map(idea => {
          const bits = [`- [${idea.status}] ${idea.title} (${idea.id})`]
          const meta = []
          if (idea.estimate !== '') meta.push(idea.estimate)
          meta.push(`${idea.linkCount} links`, `${idea.logCount} logs`)
          bits.push(` — ${meta.join(', ')}`)
          if (idea.note !== '') bits.push(`\n  ${idea.note.replace(/\s+/gu, ' ').slice(0, 140)}`)
          return bits.join('')
        })
        return answer(`${ideas.length} archived idea${ideas.length === 1 ? '' : 's'}:\n${lines.join('\n')}`)
      },
    },
    {
      name: 'idea_get',
      description:
        'Read one archived idea in full: the user\'s thought, estimate, every research link, and the saved chat logs '
        + 'with the discoveries made in them. Use this when the user starts the project and wants to be reminded.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'Idea id from idea_list.' },
          query: { type: 'string', description: 'Search the title instead, when the id is unknown.' },
          include_logs: { type: 'boolean', description: 'Include chat log transcripts. Defaults to true.' },
        },
      },
      output,
      async execute(args) {
        const id = typeof args?.id === 'string' ? args.id.trim() : ''
        const query = typeof args?.query === 'string' ? args.query.trim().toLowerCase() : ''
        let ideaId = id
        if (ideaId === '') {
          if (query === '') throw new ArchiveError('Pass an idea id or a query.')
          const ideas = await store.list()
          const exact = ideas.find(idea => idea.title.toLowerCase() === query)
          const partial = ideas.find(idea => idea.title.toLowerCase().includes(query))
          const match = exact ?? partial
          if (match === undefined) throw new ArchiveError(`No archived idea matches "${query}".`)
          ideaId = match.id
        }
        const { idea, logs } = await store.detail(ideaId)
        const lines = [ideaMarkdown(idea)]
        if (args?.include_logs !== false && logs.length > 0) {
          lines.push('', '# Transcripts', '')
          for (const log of logs) {
            lines.push(`## ${log.name}`, '')
            if (log.missing) {
              lines.push('_The saved file is missing from disk._', '')
              continue
            }
            if (log.turns.length === 0) {
              lines.push('```', log.raw.trim(), '```', '')
              continue
            }
            for (const turn of log.turns) {
              lines.push(`### ${turn.role === 'user' ? 'You' : turn.label}${turn.at === '' ? '' : ` · ${turn.at}`}`, '', turn.text, '')
            }
          }
        }
        let text = lines.join('\n')
        if (text.length > MAX_TOOL_LOG_CHARS) {
          text = `${text.slice(0, MAX_TOOL_LOG_CHARS)}\n\n_(Transcript shortened; open the Idea archive page to read the rest.)_`
        }
        return answer(text)
      },
    },
    {
      name: 'idea_add_links',
      description: 'Append research links to an archived idea, skipping URLs it already has.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'Idea id.' },
          links: {
            type: 'array',
            items: { type: 'string' },
            description: 'Links as URLs or "Label | URL".',
          },
        },
        required: ['id', 'links'],
      },
      output,
      async execute(args) {
        const { idea, added } = await store.addLinks(String(args?.id ?? ''), args?.links ?? [])
        return answer(`Added ${added} link${added === 1 ? '' : 's'} to "${idea.title}"; it now has ${idea.linkCount}.`)
      },
    },
    {
      name: 'idea_attach_log',
      description:
        'Attach a saved research conversation (for example a duck.ai export downloaded as .txt) to an archived idea. '
        + 'Pass a host file path, or the transcript text itself. The transcript is copied into the archive and parsed '
        + 'into questions and answers.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'Idea id.' },
          path: { type: 'string', description: 'Absolute path of the chat log file on this host.' },
          text: { type: 'string', description: 'Transcript text, when there is no file path.' },
          name: { type: 'string', description: 'Display name; defaults to the file name or "Chat log".' },
        },
        required: ['id'],
      },
      output,
      async execute(args) {
        const id = String(args?.id ?? '')
        const filePath = typeof args?.path === 'string' ? args.path.trim() : ''
        let text = typeof args?.text === 'string' ? args.text : ''
        let name = typeof args?.name === 'string' ? args.name : ''
        if (filePath !== '') {
          try {
            text = await readFile(filePath, 'utf8')
          } catch (error) {
            throw new ArchiveError(`Cannot read ${filePath}: ${error?.code === 'ENOENT' ? 'no such file' : error?.message ?? error}`)
          }
          if (name === '') name = basename(filePath)
        }
        if (text === '') throw new ArchiveError('Pass the chat log path or its text.')
        const { idea, log } = await store.attachLog(id, { name, text })
        const parsed = parseTranscript(text)
        return answer(
          `Attached "${log.name}" to "${idea.title}": ${parsed.promptCount} questions, `
          + `${parsed.turns.length} messages${log.model === '' ? '' : `, model ${log.model}`}.`,
        )
      },
    },
  ]
}

/**
 * Mount the archive, its tools, and the browser route.
 * @param {import('@deepseek-ai/cordis').Context} ctx host context with `tools`.
 */
export function apply(ctx) {
  const store = new IdeaStore(resolveArchiveRoot())
  for (const definition of toolDefinitions(store)) {
    ctx.effect(() => ctx.tools.register(definition))
  }
  // The Idea archive page (client.js) reads and writes this route. Resolve
  // webServer through ctx.inject rather than ctx.get: during profile boot the
  // service can mount after this plugin's apply(), and a one-time get would
  // leave the route unregistered. Routes default to the web server's
  // authenticated-peer admission, so only the signed-in page can reach it.
  ctx.inject(['webServer'], (scope) => {
    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: API_ROUTE,
      handler: createHandler(store),
    }))
  })
}
