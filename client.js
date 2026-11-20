/**
 * Idea archive — the Web UI half.
 *
 * Adds one global entry to the left sidebar (an archive box with a spark) and
 * the page it opens in the main column. The page lists the archive, opens one
 * idea with its thought, estimate, research links and saved chat transcripts,
 * and can create, edit, attach a duck.ai export, or delete an idea. Every read
 * and write goes through the Host half's `/idea-archive/api` route.
 *
 * The client half is plain JavaScript in the module-loader format, so it needs
 * no build step; styles are one component-local `<style>` element using host
 * theme tokens only.
 */

window.__ModuleLoader__.load({
  id: '@local/idea-archive',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'ideaArchive'
    const PANEL_ID = 'idea-archive'
    const API = '/idea-archive/api'
    const MAX_LOG_BYTES = 4 * 1024 * 1024

    const dictionaries = {
      en: {
        panel: 'Idea archive',
        title: 'Idea archive',
        subtitle: 'Projects you explored for a few minutes, kept with their research.',
        newIdea: 'New idea',
        searchPlaceholder: 'Search ideas',
        filterAll: 'All',
        statusIdea: 'Idea',
        statusDoing: 'In progress',
        statusDone: 'Done',
        linkCountOne: 'link',
        linkCountMany: 'links',
        logCountOne: 'chat log',
        logCountMany: 'chat logs',
        emptyTitle: 'Nothing archived yet',
        emptyBody: 'While you research, ask the agent to save the idea and attach the duck.ai export you downloaded. It stores your thought, the time estimate, every link, and the transcript, so you can pick the project back up later. You can also add one here.',
        emptyFiltered: 'No ideas match this search.',
        loading: 'Loading…',
        loadFailed: 'Could not reach the idea archive.',
        retry: 'Retry',
        formNewTitle: 'New idea',
        formEditTitle: 'Edit idea',
        fieldTitle: 'Title',
        fieldTitlePlaceholder: 'Install OpenWrt on the garage router',
        fieldNote: 'My thought',
        fieldNotePlaceholder: 'What you concluded while exploring…',
        fieldEstimate: 'Time estimate',
        fieldEstimatePlaceholder: 'about an hour',
        fieldLinks: 'Research links',
        fieldLinksPlaceholder: 'One per line: https://example.com — or Label | https://example.com',
        fieldLog: 'Chat log',
        fieldLogHint: 'Optional .txt export from duck.ai',
        chooseFile: 'Choose file',
        noFile: 'No file chosen',
        save: 'Save idea',
        saveChanges: 'Save changes',
        cancel: 'Cancel',
        invalidTitle: 'Give the idea a title.',
        invalidLink: 'Links must start with http:// or https://.',
        thoughtHeading: 'My thought',
        noThought: 'No note saved.',
        estimateLabel: 'Estimate',
        noEstimate: 'No estimate',
        linksHeading: 'Research links',
        noLinks: 'No links saved yet.',
        addLink: 'Add link',
        linkUrlPlaceholder: 'https://…',
        linkLabelPlaceholder: 'Label (optional)',
        add: 'Add',
        logsHeading: 'Saved research',
        noLogs: 'No chat logs attached yet. Attach the duck.ai export you downloaded.',
        attachLog: 'Attach chat log',
        attaching: 'Attaching…',
        remove: 'Remove',
        deleteIdea: 'Delete idea',
        deleteConfirm: 'Delete this idea and its saved chat logs?',
        deleteYes: 'Delete permanently',
        edit: 'Edit',
        updated: 'Updated',
        saved: 'Saved',
        questions: 'questions',
        messages: 'messages',
        rawLog: 'Raw text',
        missingLog: 'The saved file is missing from disk.',
        logTooLarge: 'That file is larger than 4 MiB.',
        readFailed: 'Could not read that file.',
        genericError: 'Something went wrong.',
        storageHint: 'Stored in your DSH home folder.',
        attached: 'Chat log attached.',
        savedNotice: 'Idea saved.',
        linkAdded: 'Link added.',
        deleted: 'Idea deleted.',
        back: 'All ideas',
        missingLogTitle: 'Chat log',
        you: 'You',
        saving: 'Saving…',
        statusLabel: 'Status',
        filterLabel: 'Filter by status',
        dismiss: 'Dismiss',
        editLinksHint: 'Research links and chat logs are managed on the idea page.',
        noIdeasView: 'No ideas in this view.',
        removeConfirm: 'Remove?',
      },
      zh: {
        panel: '想法归档',
        title: '想法归档',
        subtitle: '花几分钟探索过、并连同调研资料一起保存的项目。',
        newIdea: '新建想法',
        searchPlaceholder: '搜索想法',
        filterAll: '全部',
        statusIdea: '想法',
        statusDoing: '进行中',
        statusDone: '已完成',
        linkCountOne: '个链接',
        linkCountMany: '个链接',
        logCountOne: '份聊天记录',
        logCountMany: '份聊天记录',
        emptyTitle: '还没有归档的想法',
        emptyBody: '调研时可以让智能体保存想法，并附上你下载的 duck.ai 对话记录。它会保存你的结论、预计耗时、所有链接和完整对话，之后可以随时接着做。你也可以在这里新建。',
        emptyFiltered: '没有符合搜索条件的想法。',
        loading: '加载中…',
        loadFailed: '无法连接想法归档。',
        retry: '重试',
        formNewTitle: '新建想法',
        formEditTitle: '编辑想法',
        fieldTitle: '标题',
        fieldTitlePlaceholder: '给车库的路由器安装 OpenWrt',
        fieldNote: '我的想法',
        fieldNotePlaceholder: '探索后得出的结论…',
        fieldEstimate: '预计耗时',
        fieldEstimatePlaceholder: '大约一小时',
        fieldLinks: '调研链接',
        fieldLinksPlaceholder: '每行一个：https://example.com，或 标题 | https://example.com',
        fieldLog: '聊天记录',
        fieldLogHint: '可选，duck.ai 导出的 .txt 文件',
        chooseFile: '选择文件',
        noFile: '未选择文件',
        save: '保存想法',
        saveChanges: '保存修改',
        cancel: '取消',
        invalidTitle: '请填写想法标题。',
        invalidLink: '链接需要以 http:// 或 https:// 开头。',
        thoughtHeading: '我的想法',
        noThought: '还没有记录想法。',
        estimateLabel: '预计耗时',
        noEstimate: '未填写',
        linksHeading: '调研链接',
        noLinks: '还没有保存链接。',
        addLink: '添加链接',
        linkUrlPlaceholder: 'https://…',
        linkLabelPlaceholder: '标题（可选）',
        add: '添加',
        logsHeading: '保存的调研',
        noLogs: '还没有聊天记录。可以把下载的 duck.ai 导出文件附在这里。',
        attachLog: '添加聊天记录',
        attaching: '正在添加…',
        remove: '移除',
        deleteIdea: '删除想法',
        deleteConfirm: '删除这个想法以及保存的聊天记录？',
        deleteYes: '永久删除',
        edit: '编辑',
        updated: '更新于',
        saved: '保存于',
        questions: '个问题',
        messages: '条消息',
        rawLog: '原始文本',
        missingLog: '保存的文件已不在磁盘上。',
        logTooLarge: '文件超过 4 MiB。',
        readFailed: '无法读取该文件。',
        genericError: '出了点问题。',
        storageHint: '保存在你的 DSH 主目录中。',
        attached: '聊天记录已添加。',
        savedNotice: '想法已保存。',
        linkAdded: '链接已添加。',
        deleted: '想法已删除。',
        back: '全部想法',
        missingLogTitle: '聊天记录',
        you: '你',
        saving: '正在保存…',
        statusLabel: '状态',
        filterLabel: '按状态筛选',
        dismiss: '关闭提示',
        editLinksHint: '调研链接和聊天记录在想法详情页管理。',
        noIdeasView: '此视图没有想法。',
        removeConfirm: '移除？',
      },
    }

    const english = dictionaries.en

    /** Fallback used only when the slot renderer does not provide its translator. */
    const fallbackTranslate = key => english[key] ?? key

    function formatBytes(size) {
      if (!Number.isInteger(size) || size <= 0) return ''
      if (size < 1024) return `${size} B`
      if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
      return `${(size / 1024 / 1024).toFixed(1)} MB`
    }

    function formatDate(iso) {
      if (typeof iso !== 'string' || iso === '') return ''
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }

    function plural(t, count, one, many) {
      return `${count} ${count === 1 ? t(one) : t(many)}`
    }

    /** Parse the links textarea into link objects. */
    function parseLinkLines(text) {
      const links = []
      for (const raw of text.split('\n')) {
        const line = raw.trim()
        if (line === '') continue
        const separator = line.indexOf('|')
        const candidate = separator >= 0
          ? { url: line.slice(separator + 1).trim(), title: line.slice(0, separator).trim() }
          : { url: line, title: '' }
        if (!/^https?:\/\//iu.test(candidate.url)) return { error: true, links: [] }
        links.push(candidate)
      }
      return { error: false, links }
    }

    async function requestJson(url, options) {
      let response
      try {
        response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options })
      } catch (error) {
        throw new Error('network')
      }
      let payload = null
      try { payload = await response.json() } catch (error) { payload = null }
      if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`)
      return payload
    }

    function fetchList() {
      return requestJson(API)
    }

    function fetchIdea(id) {
      return requestJson(`${API}?view=idea&id=${encodeURIComponent(id)}`)
    }

    function mutate(body) {
      return requestJson(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    /** Inline formatting for a saved transcript: bold, code, and live links. */
    function RichText({ text }) {
      // Bold and code win over links so a marked-up run keeps its formatting;
      // trailing sentence punctuation stays outside the anchor target.
      const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`|(https?:\/\/[^\s<>"')\]]+)/gu
      const nodes = []
      let last = 0
      let index = 0
      let match
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index))
        if (match[1] !== undefined) {
          nodes.push(h('strong', { key: `s${index}` }, match[1]))
        } else if (match[2] !== undefined) {
          nodes.push(h('code', { key: `c${index}`, className: 'ia-code' }, match[2]))
        } else {
          const raw = match[3]
          const url = raw.replace(/[.,;:!?]+$/u, '')
          nodes.push(h('a', {
            key: `a${index}`,
            href: url,
            target: '_blank',
            rel: 'noreferrer noopener',
            className: 'ia-link',
          }, url))
          if (url.length < raw.length) nodes.push(raw.slice(url.length))
        }
        last = pattern.lastIndex
        index += 1
      }
      if (last < text.length) nodes.push(text.slice(last))
      return h(React.Fragment, null, ...nodes)
    }

    function StatusPill({ status, t }) {
      const label = status === 'done' ? t('statusDone') : status === 'doing' ? t('statusDoing') : t('statusIdea')
      return h('span', { className: `ia-pill ia-pill-${status}` },
        h('span', { className: 'ia-pill-dot', 'aria-hidden': true }),
        label)
    }

    /** The create/edit form for one idea. */
    function IdeaForm({ t, initial, editing, busy, error, onCancel, onSubmit }) {
      const [title, setTitle] = React.useState(initial?.title ?? '')
      const [note, setNote] = React.useState(initial?.note ?? '')
      const [estimate, setEstimate] = React.useState(initial?.estimate ?? '')
      const [links, setLinks] = React.useState('')
      const [file, setFile] = React.useState(null)
      const [localError, setLocalError] = React.useState('')
      const fileRef = React.useRef(null)

      const submit = event => {
        event.preventDefault()
        if (title.trim() === '') {
          setLocalError(t('invalidTitle'))
          return
        }
        let parsed = { error: false, links: [] }
        if (!editing) {
          parsed = parseLinkLines(links)
          if (parsed.error) {
            setLocalError(t('invalidLink'))
            return
          }
        }
        setLocalError('')
        onSubmit({
          title: title.trim(),
          note: note.trim(),
          estimate: estimate.trim(),
          links: parsed.links,
          file,
        })
      }

      return h('form', { className: 'ia-form', onSubmit: submit },
        h('h2', { className: 'ia-form-title' }, editing ? t('formEditTitle') : t('formNewTitle')),
        h('label', { className: 'ia-field' },
          h('span', { className: 'ia-label' }, t('fieldTitle')),
          h('input', {
            className: 'ia-input',
            value: title,
            placeholder: t('fieldTitlePlaceholder'),
            onChange: event => { setTitle(event.target.value) },
            autoFocus: true,
          })),
        h('label', { className: 'ia-field' },
          h('span', { className: 'ia-label' }, t('fieldNote')),
          h('textarea', {
            className: 'ia-input ia-textarea',
            value: note,
            rows: 3,
            placeholder: t('fieldNotePlaceholder'),
            onChange: event => { setNote(event.target.value) },
          })),
        h('label', { className: 'ia-field ia-field-narrow' },
          h('span', { className: 'ia-label' }, t('fieldEstimate')),
          h('input', {
            className: 'ia-input',
            value: estimate,
            placeholder: t('fieldEstimatePlaceholder'),
            onChange: event => { setEstimate(event.target.value) },
          })),
        editing && h('p', { className: 'ia-hint' }, t('editLinksHint')),
        !editing && h('label', { className: 'ia-field' },
          h('span', { className: 'ia-label' }, t('fieldLinks')),
          h('textarea', {
            className: 'ia-input ia-textarea',
            value: links,
            rows: 2,
            placeholder: t('fieldLinksPlaceholder'),
            onChange: event => { setLinks(event.target.value) },
          })),
        !editing && h('div', { className: 'ia-field' },
          h('span', { className: 'ia-label' }, t('fieldLog')),
          h('div', { className: 'ia-file' },
            h('button', {
              type: 'button',
              className: 'ia-btn',
              onClick: () => { fileRef.current?.click() },
            }, t('chooseFile')),
            h('span', { className: 'ia-hint' }, file === null ? t('noFile') : `${file.name} · ${formatBytes(file.size)}`),
            h('input', {
              ref: fileRef,
              type: 'file',
              accept: '.txt,.md,text/plain',
              className: 'ia-hidden-input',
              tabIndex: -1,
              'aria-label': t('fieldLog'),
              onChange: event => { setFile(event.target.files?.[0] ?? null) },
            })),
          h('span', { className: 'ia-hint' }, t('fieldLogHint'))),
        (localError !== '' || error !== '') && h('p', { className: 'ia-form-error', role: 'alert' }, localError || error),
        h('div', { className: 'ia-form-actions' },
          h('button', { type: 'button', className: 'ia-btn', onClick: onCancel, disabled: busy }, t('cancel')),
          h('button', { type: 'submit', className: 'ia-btn ia-btn-primary', disabled: busy }, busy ? t('saving') : editing ? t('saveChanges') : t('save'))))
    }

    /** One archived idea in the list. */
    function IdeaCard({ idea, t, onOpen }) {
      const open = () => { onOpen(idea.id) }
      const status = idea.status === 'done' ? t('statusDone') : idea.status === 'doing' ? t('statusDoing') : t('statusIdea')
      const summary = [status, idea.estimate, plural(t, idea.linkCount, 'linkCountOne', 'linkCountMany'),
        plural(t, idea.logCount, 'logCountOne', 'logCountMany'), `${t('updated')} ${formatDate(idea.updatedAt)}`]
        .filter(Boolean).join(', ')
      return h('div', {
        className: 'ia-card',
        role: 'button',
        tabIndex: 0,
        'aria-label': `${idea.title}. ${summary}`,
        onClick: open,
        onKeyDown: event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            open()
          }
        },
      },
      h('div', { className: 'ia-card-head' },
        h('span', { className: 'ia-card-title' }, idea.title),
        h(StatusPill, { status: idea.status, t })),
      idea.note !== '' && h('p', { className: 'ia-card-note' }, idea.note),
      h('div', { className: 'ia-card-meta' },
        idea.estimate !== '' && h('span', { className: 'ia-chip' }, idea.estimate),
        h('span', null, plural(t, idea.linkCount, 'linkCountOne', 'linkCountMany')),
        h('span', null, plural(t, idea.logCount, 'logCountOne', 'logCountMany')),
        h('span', { className: 'ia-muted' }, `${t('updated')} ${formatDate(idea.updatedAt)}`)))
    }

    /** One saved conversation, parsed into turns by the Host. */
    function Transcript({ log, t }) {
      const head = h('div', { className: 'ia-log-head' },
        h('div', { className: 'ia-log-title' },
          h('span', { className: 'ia-log-name' }, log.name),
          h('span', { className: 'ia-hint' },
            [log.kind === 'duck.ai' ? 'duck.ai' : null,
              log.model !== '' ? log.model : null,
              log.promptCount > 0 ? `${log.promptCount} ${t('questions')}` : null,
              log.turns.length > 0 ? `${log.turns.length} ${t('messages')}` : null,
              formatBytes(log.size)].filter(Boolean).join(' · '))))

      let body
      if (log.missing) {
        body = h('p', { className: 'ia-hint ia-pad' }, t('missingLog'))
      } else if (log.turns.length === 0) {
        body = h('pre', { className: 'ia-raw' }, log.raw === '' ? t('rawLog') : log.raw)
      } else {
        body = h('div', null, ...log.turns.map((turn, index) => h('div', {
          key: `${log.id}-${index}`,
          className: `ia-turn ia-turn-${turn.role}`,
        },
        h('div', { className: 'ia-turn-head' },
          h('span', { className: 'ia-speaker' }, turn.role === 'user' ? t('you') : turn.label),
          turn.at !== '' && h('span', { className: 'ia-hint' }, turn.at)),
        h('div', { className: 'ia-turn-text' }, h(RichText, { text: turn.text })))))
      }

      return h('section', { className: 'ia-log', 'aria-label': log.name }, head, body)
    }

    /** The whole page: list, one idea, or the create form. */
    function IdeaArchivePage(props) {
      const t = props.t ?? fallbackTranslate
      const [ideas, setIdeas] = React.useState([])
      const [storage, setStorage] = React.useState('')
      const [listState, setListState] = React.useState('loading')
      const [listError, setListError] = React.useState('')
      const [selectedId, setSelectedId] = React.useState('')
      const [detail, setDetail] = React.useState(null)
      const [detailState, setDetailState] = React.useState('idle')
      const [mode, setMode] = React.useState('browse')
      const [busy, setBusy] = React.useState('')
      const [formError, setFormError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [hostNotice, setHostNotice] = React.useState('')
      const [error, setError] = React.useState('')
      const [filter, setFilter] = React.useState('all')
      const [query, setQuery] = React.useState('')
      const [linkDraft, setLinkDraft] = React.useState({ url: '', title: '' })
      const [linkError, setLinkError] = React.useState('')
      const [confirming, setConfirming] = React.useState(false)
      const [pendingRemoval, setPendingRemoval] = React.useState({ kind: '', id: '' })
      const uploadRef = React.useRef(null)
      const bodyRef = React.useRef(null)
      const headingRef = React.useRef(null)
      const searchRef = React.useRef(null)
      const detailRequest = React.useRef(0)
      const focusDetail = React.useRef(false)
      const focusList = React.useRef(false)

      const loadList = React.useCallback(async () => {
        setListState(current => (current === 'ready' ? 'ready' : 'loading'))
        try {
          const data = await fetchList()
          setIdeas(Array.isArray(data?.ideas) ? data.ideas : [])
          setStorage(typeof data?.storage === 'string' ? data.storage : '')
          setListState('ready')
          setListError('')
          if (data?.notice) setHostNotice(data.notice)
        } catch (failure) {
          setListState('error')
          setListError(t('loadFailed'))
        }
      }, [t])

      const loadIdea = React.useCallback(async id => {
        if (id === '') return
        const request = ++detailRequest.current
        setDetailState('loading')
        try {
          const data = await fetchIdea(id)
          // A slow earlier response must not replace the idea selected now.
          if (request !== detailRequest.current) return
          setDetail(data)
          setDetailState('ready')
        } catch (failure) {
          if (request !== detailRequest.current) return
          setDetailState('error')
        }
      }, [])

      React.useEffect(() => {
        void loadList()
      }, [loadList])

      React.useEffect(() => {
        if (notice === '') return undefined
        const timer = window.setTimeout(() => { setNotice('') }, 5000)
        return () => { window.clearTimeout(timer) }
      }, [notice])

      // One scrollport serves every view: opening, creating and editing all
      // start at the top instead of at the previous view's offset.
      React.useEffect(() => {
        if (bodyRef.current !== null) bodyRef.current.scrollTop = 0
      }, [selectedId, mode])

      // Focus follows the new view so a keyboard user is not dropped.
      React.useEffect(() => {
        if (focusDetail.current && detail !== null) {
          focusDetail.current = false
          headingRef.current?.focus()
        }
      }, [detail])

      React.useEffect(() => {
        if (focusList.current && selectedId === '' && mode === 'browse') {
          focusList.current = false
          searchRef.current?.focus()
        }
      }, [selectedId, mode])

      const refresh = async id => {
        await loadList()
        if (id !== '') await loadIdea(id)
      }

      const openIdea = id => {
        focusDetail.current = true
        setSelectedId(id)
        setMode('browse')
        setConfirming(false)
        setPendingRemoval({ kind: '', id: '' })
        setLinkDraft({ url: '', title: '' })
        setLinkError('')
        setDetail(null)
        setError('')
        void loadIdea(id)
      }

      const backToList = () => {
        focusList.current = true
        setSelectedId('')
        setDetail(null)
        setMode('browse')
        setConfirming(false)
        setPendingRemoval({ kind: '', id: '' })
        setLinkDraft({ url: '', title: '' })
        setLinkError('')
        setError('')
      }

      const startCreate = () => {
        setMode('new')
        setFormError('')
        setLinkError('')
        setError('')
        setHostNotice('')
      }

      const createIdea = async values => {
        setBusy('create')
        setFormError('')
        let id = ''
        try {
          const created = await mutate({
            action: 'create',
            title: values.title,
            note: values.note,
            estimate: values.estimate,
            links: values.links,
          })
          id = created?.idea?.id ?? ''
        } catch (failure) {
          setFormError(failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError'))
          setBusy('')
          return
        }
        // The idea exists once creation succeeds: a failed attachment must not
        // leave the form up, or a second submit would create a duplicate.
        let attachError = ''
        if (values.file !== null && id !== '') {
          try {
            const text = await readLogFile(values.file)
            await mutate({ action: 'attach-log', id, name: values.file.name, text })
          } catch (failure) {
            attachError = failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError')
          }
        }
        await loadList()
        if (id !== '') openIdea(id)
        if (attachError === '') setNotice(t('savedNotice'))
        else setError(attachError)
        setBusy('')
      }

      const readLogFile = async file => {
        if (file.size > MAX_LOG_BYTES) throw new Error(t('logTooLarge'))
        try {
          return await file.text()
        } catch (failure) {
          throw new Error(t('readFailed'))
        }
      }

      const saveEdit = async values => {
        setBusy('edit')
        setFormError('')
        try {
          await mutate({
            action: 'update',
            id: selectedId,
            title: values.title,
            note: values.note,
            estimate: values.estimate,
          })
          setNotice(t('savedNotice'))
          setMode('browse')
          await refresh(selectedId)
        } catch (failure) {
          setFormError(failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError'))
        } finally {
          setBusy('')
        }
      }

      const changeStatus = async status => {
        setBusy('status')
        setError('')
        try {
          await mutate({ action: 'update', id: selectedId, status })
          await refresh(selectedId)
        } catch (failure) {
          setError(failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError'))
        } finally {
          setBusy('')
        }
      }

      const addLink = async event => {
        event.preventDefault()
        const url = linkDraft.url.trim()
        if (!/^https?:\/\//iu.test(url)) {
          setLinkError(t('invalidLink'))
          return
        }
        setLinkError('')
        setBusy('link')
        setError('')
        try {
          await mutate({ action: 'add-link', id: selectedId, url, title: linkDraft.title.trim() })
          setLinkDraft({ url: '', title: '' })
          setLinkError('')
          setNotice(t('linkAdded'))
          await refresh(selectedId)
        } catch (failure) {
          setError(failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError'))
        } finally {
          setBusy('')
        }
      }

      const removeLink = async linkId => {
        setPendingRemoval({ kind: '', id: '' })
        setBusy(`link:${linkId}`)
        setError('')
        try {
          await mutate({ action: 'remove-link', id: selectedId, linkId })
          await refresh(selectedId)
        } catch (failure) {
          setError(failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError'))
        } finally {
          setBusy('')
        }
      }

      const attachLog = async file => {
        setBusy('log')
        setError('')
        try {
          const text = await readLogFile(file)
          await mutate({ action: 'attach-log', id: selectedId, name: file.name, text })
          setNotice(t('attached'))
          await refresh(selectedId)
        } catch (failure) {
          setError(failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError'))
        } finally {
          setBusy('')
        }
      }

      const removeLog = async logId => {
        setPendingRemoval({ kind: '', id: '' })
        setBusy(`log:${logId}`)
        setError('')
        try {
          await mutate({ action: 'remove-log', id: selectedId, logId })
          await refresh(selectedId)
        } catch (failure) {
          setError(failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError'))
        } finally {
          setBusy('')
        }
      }

      const deleteIdea = async () => {
        setBusy('delete')
        setError('')
        try {
          await mutate({ action: 'delete', id: selectedId })
          setNotice(t('deleted'))
          backToList()
          await loadList()
        } catch (failure) {
          setError(failure?.message === 'network' ? t('loadFailed') : failure?.message ?? t('genericError'))
        } finally {
          setBusy('')
        }
      }

      const filtered = ideas.filter(idea => {
        if (filter !== 'all' && idea.status !== filter) return false
        if (query.trim() === '') return true
        const needle = query.trim().toLowerCase()
        const haystack = [idea.title, idea.note, ...(idea.links ?? []).map(link => `${link.title} ${link.url}`)]
          .join('\n')
          .toLowerCase()
        return haystack.includes(needle)
      })

      const counts = {
        all: ideas.length,
        idea: ideas.filter(idea => idea.status === 'idea').length,
        doing: ideas.filter(idea => idea.status === 'doing').length,
        done: ideas.filter(idea => idea.status === 'done').length,
      }

      const toolbar = h('div', { className: 'ia-toolbar' },
        h('div', { className: 'ia-filters', role: 'group', 'aria-label': t('filterLabel') },
          ...['all', 'idea', 'doing', 'done'].map(value => h('button', {
            key: value,
            type: 'button',
            className: `ia-filter${filter === value ? ' ia-filter-active' : ''}`,
            'aria-pressed': filter === value,
            onClick: () => { setFilter(value) },
          }, `${value === 'all' ? t('filterAll') : value === 'idea' ? t('statusIdea') : value === 'doing' ? t('statusDoing') : t('statusDone')}`,
          h('span', { className: 'ia-filter-count' }, String(counts[value]))))),
        h('input', {
          ref: searchRef,
          className: 'ia-input ia-search',
          type: 'search',
          value: query,
          placeholder: t('searchPlaceholder'),
          'aria-label': t('searchPlaceholder'),
          onChange: event => { setQuery(event.target.value) },
        }))

      const banner = (tone, message, dismiss) => h('div', {
        className: `ia-banner ia-banner-${tone}`,
        role: tone === 'error' ? 'alert' : 'status',
      },
      h('span', { className: 'ia-banner-dot', 'aria-hidden': true }),
      h('span', { className: 'ia-banner-text' }, message),
      dismiss !== undefined && h('button', {
        type: 'button',
        className: 'ia-link-btn',
        'aria-label': t('dismiss'),
        onClick: dismiss,
      }, '×'))

      const banners = h(React.Fragment, null,
        error !== '' && banner('error', error, () => { setError('') }),
        hostNotice !== '' && banner('warn', hostNotice, () => { setHostNotice('') }),
        notice !== '' && banner('ok', notice))

      let body
      if (mode === 'new') {
        body = h(IdeaForm, { key: 'create', t, editing: false, busy: busy === 'create', error: formError, onCancel: () => { setMode('browse') }, onSubmit: createIdea })
      } else if (selectedId !== '') {
        if (detailState === 'loading' && detail === null) {
          body = h('p', { className: 'ia-hint ia-pad' }, t('loading'))
        } else if (detailState === 'error' || detail === null) {
          body = h(React.Fragment, null,
            h('div', { className: 'ia-detail-head' },
              h('button', { type: 'button', className: 'ia-back', onClick: backToList }, `← ${t('back')}`)),
            h('div', { className: 'ia-empty' },
              h('p', { className: 'ia-empty-title' }, t('loadFailed')),
              h('button', { type: 'button', className: 'ia-btn', onClick: () => { void loadIdea(selectedId) } }, t('retry'))))
        } else if (mode === 'edit') {
          body = h(IdeaForm, {
            key: 'edit',
            t,
            editing: true,
            initial: detail.idea,
            busy: busy === 'edit',
            error: formError,
            onCancel: () => { setMode('browse') },
            onSubmit: saveEdit,
          })
        } else {
          const idea = detail.idea
          body = h(React.Fragment, null,
            h('div', { className: 'ia-detail-head' },
              h('button', { type: 'button', className: 'ia-back', onClick: backToList }, `← ${t('back')}`),
              h('div', { className: 'ia-detail-actions' },
                h('button', { type: 'button', className: 'ia-btn', onClick: () => { setMode('edit'); setFormError('') }, disabled: busy !== '' }, t('edit')),
                confirming
                  ? h(React.Fragment, null,
                    h('span', { className: 'ia-hint' }, t('deleteConfirm')),
                    h('button', { type: 'button', className: 'ia-btn ia-btn-danger', onClick: deleteIdea, disabled: busy === 'delete' }, t('deleteYes')),
                    h('button', { type: 'button', className: 'ia-btn', onClick: () => { setConfirming(false) } }, t('cancel')))
                  : h('button', { type: 'button', className: 'ia-btn ia-btn-quiet', onClick: () => { setConfirming(true) } }, t('deleteIdea')))),
            h('h2', { ref: headingRef, tabIndex: -1, className: 'ia-detail-title' }, idea.title),
            h('div', { className: 'ia-detail-meta' },
              h(StatusPill, { status: idea.status, t }),
              h('div', { className: 'ia-status-switch', role: 'group', 'aria-label': t('statusLabel') },
                ...['idea', 'doing', 'done'].map(value => h('button', {
                  key: value,
                  type: 'button',
                  className: `ia-filter${idea.status === value ? ' ia-filter-active' : ''}`,
                  'aria-pressed': idea.status === value,
                  disabled: busy === 'status',
                  onClick: () => { if (idea.status !== value) void changeStatus(value) },
                }, value === 'idea' ? t('statusIdea') : value === 'doing' ? t('statusDoing') : t('statusDone')))),
              h('span', { className: 'ia-hint' }, `${t('saved')} ${formatDate(idea.createdAt)}`)),
            h('section', { className: 'ia-block' },
              h('div', { className: 'ia-block-head' },
                h('h2', { className: 'ia-block-title' }, t('thoughtHeading')),
                idea.estimate !== '' && h('span', { className: 'ia-chip' }, `${t('estimateLabel')}: ${idea.estimate}`)),
              h('p', { className: 'ia-note' }, idea.note === '' ? t('noThought') : idea.note)),
            h('section', { className: 'ia-block' },
              h('div', { className: 'ia-block-head' },
                h('h2', { className: 'ia-block-title' }, t('linksHeading')),
                h('span', { className: 'ia-hint' }, plural(t, idea.links.length, 'linkCountOne', 'linkCountMany'))),
              idea.links.length === 0
                ? h('p', { className: 'ia-hint' }, t('noLinks'))
                : h('ul', { className: 'ia-links' }, ...idea.links.map(link => h('li', { key: link.id, className: 'ia-link-row' },
                  h('a', {
                    className: 'ia-link',
                    href: link.url,
                    target: '_blank',
                    rel: 'noreferrer noopener',
                    title: link.url,
                  }, link.title === '' ? link.url : link.title),
                  link.title !== '' && h('span', { className: 'ia-hint ia-link-url' }, link.url),
                  pendingRemoval.kind === 'link' && pendingRemoval.id === link.id
                    ? h('span', { className: 'ia-confirm' },
                      h('span', { className: 'ia-hint' }, t('removeConfirm')),
                      h('button', {
                        type: 'button',
                        className: 'ia-mini',
                        disabled: busy === `link:${link.id}`,
                        onClick: () => { void removeLink(link.id) },
                      }, t('remove')),
                      h('button', {
                        type: 'button',
                        className: 'ia-mini',
                        onClick: () => { setPendingRemoval({ kind: '', id: '' }) },
                      }, t('cancel')))
                    : h('button', {
                      type: 'button',
                      className: 'ia-mini',
                      'aria-label': `${t('remove')} ${link.title === '' ? link.url : link.title}`,
                      onClick: () => { setPendingRemoval({ kind: 'link', id: link.id }) },
                    }, t('remove'))))),
              h('form', { className: 'ia-link-form', onSubmit: addLink },
                h('input', {
                  className: 'ia-input',
                  type: 'text',
                  inputMode: 'url',
                  value: linkDraft.url,
                  placeholder: t('linkUrlPlaceholder'),
                  'aria-label': t('linkUrlPlaceholder'),
                  onChange: event => {
                    setLinkError('')
                    setLinkDraft(current => ({ ...current, url: event.target.value }))
                  },
                }),
                h('input', {
                  className: 'ia-input',
                  value: linkDraft.title,
                  placeholder: t('linkLabelPlaceholder'),
                  'aria-label': t('linkLabelPlaceholder'),
                  onChange: event => { setLinkDraft(current => ({ ...current, title: event.target.value })) },
                }),
                h('button', { type: 'submit', className: 'ia-btn', disabled: busy === 'link' }, t('add'))),
              linkError !== '' && h('p', { className: 'ia-form-error', role: 'alert' }, linkError)),
            h('section', { className: 'ia-block' },
              h('div', { className: 'ia-block-head' },
                h('h2', { className: 'ia-block-title' }, t('logsHeading')),
                h('div', { className: 'ia-log-actions' },
                  h('button', {
                    type: 'button',
                    className: 'ia-btn',
                    disabled: busy === 'log',
                    onClick: () => { uploadRef.current?.click() },
                  }, busy === 'log' ? t('attaching') : t('attachLog')),
                  h('input', {
                    ref: uploadRef,
                    type: 'file',
                    accept: '.txt,.md,text/plain',
                    className: 'ia-hidden-input',
                    tabIndex: -1,
                    'aria-label': t('attachLog'),
                    onChange: event => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file !== undefined) void attachLog(file)
                    },
                  }))),
              detail.logs.length === 0
                ? h('p', { className: 'ia-hint' }, t('noLogs'))
                : h('div', { className: 'ia-logs' }, ...detail.logs.map(log => h('div', { key: log.id, className: 'ia-log-wrap' },
                  h(Transcript, { log, t }),
                  h('div', { className: 'ia-log-foot' },
                    pendingRemoval.kind === 'log' && pendingRemoval.id === log.id
                      ? h('span', { className: 'ia-confirm' },
                        h('span', { className: 'ia-hint' }, t('removeConfirm')),
                        h('button', {
                          type: 'button',
                          className: 'ia-mini',
                          disabled: busy === `log:${log.id}`,
                          onClick: () => { void removeLog(log.id) },
                        }, t('remove')),
                        h('button', {
                          type: 'button',
                          className: 'ia-mini',
                          onClick: () => { setPendingRemoval({ kind: '', id: '' }) },
                        }, t('cancel')))
                      : h('button', {
                        type: 'button',
                        className: 'ia-mini',
                        'aria-label': `${t('remove')} ${log.name}`,
                        onClick: () => { setPendingRemoval({ kind: 'log', id: log.id }) },
                      }, t('remove'))))))))
        }
      } else if (listState === 'error') {
        body = h('div', { className: 'ia-empty' },
          h('p', { className: 'ia-empty-title' }, listError),
          h('button', { type: 'button', className: 'ia-btn', onClick: () => { void loadList() } }, t('retry')))
      } else if (listState === 'loading') {
        body = h('p', { className: 'ia-hint ia-pad' }, t('loading'))
      } else if (ideas.length === 0) {
        body = h('div', { className: 'ia-empty' },
          h(BoxArt, null),
          h('p', { className: 'ia-empty-title' }, t('emptyTitle')),
          h('p', { className: 'ia-hint' }, t('emptyBody')),
          h('button', { type: 'button', className: 'ia-btn ia-btn-primary', onClick: startCreate }, `+ ${t('newIdea')}`))
      } else {
        body = h(React.Fragment, null,
          toolbar,
          filtered.length === 0
            ? h('p', { className: 'ia-hint ia-pad' }, t('noIdeasView'))
            : h('div', { className: 'ia-list' }, ...filtered.map(idea => h(IdeaCard, {
              key: idea.id,
              idea,
              t,
              onOpen: openIdea,
            }))),
          storage !== '' && h('p', { className: 'ia-footnote' }, `${t('storageHint')} ${storage}`))
      }

      return h('div', { className: 'ia-page' },
        h('style', null, STYLES),
        h('header', { className: 'ia-head' },
          h('div', { className: 'ia-head-inner' },
            h('div', null,
              h('h1', { className: 'ia-title' }, t('title')),
              h('p', { className: 'ia-sub' }, t('subtitle'))),
            mode === 'browse' && h('button', { type: 'button', className: 'ia-btn ia-btn-primary', onClick: startCreate }, `+ ${t('newIdea')}`))),
        h('div', { ref: bodyRef, className: 'ia-body' },
          h('div', { className: 'ia-column' }, banners, body)))
    }

    /** Empty-state artwork: the same archive box as the sidebar entry. */
    function BoxArt() {
      return h('svg', {
        viewBox: '0 0 36 36',
        width: 40,
        height: 40,
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block', color: 'var(--dsw-alias-label-secondary)', opacity: 0.7 },
      },
      h('rect', { x: 8, y: 12, width: 20, height: 6, rx: 2, fill: 'currentColor' }),
      h('rect', { x: 10, y: 18, width: 16, height: 13, rx: 2, fill: 'currentColor', opacity: 0.45 }),
      h('path', { d: 'M26 4l1.3 3.4L31 8.7l-3.7 1.3L26 13.4l-1.3-3.4L21 8.7l3.7-1.3z', fill: 'currentColor' }))
    }

    /** The left sidebar entry; the sidebar owns the button, label, and selected state. */
    function ArchiveIcon({ size }) {
      return h('svg', {
        viewBox: '0 0 36 36',
        width: size,
        height: size,
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      },
      h('rect', { x: 8, y: 12, width: 20, height: 6, rx: 2, fill: 'currentColor' }),
      h('rect', { x: 10, y: 18, width: 16, height: 13, rx: 2, fill: 'currentColor', opacity: 0.45 }),
      h('path', { d: 'M26 4l1.3 3.4L31 8.7l-3.7 1.3L26 13.4l-1.3-3.4L21 8.7l3.7-1.3z', fill: 'currentColor' }))
    }

    const STYLES = `
.ia-page { height: 100%; display: flex; flex-direction: column; box-sizing: border-box; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); }
.ia-head { flex: none; padding: calc(28px + var(--dsh-frame-top-clearance, 0px)) clamp(20px, 4vw, 48px) 10px; }
.ia-head-inner { max-width: 960px; margin: 0 auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ia-title { margin: 0; font-size: 20px; line-height: 28px; font-weight: 500; letter-spacing: -0.01em; }
.ia-sub { margin: 4px 0 0; font-size: 13px; line-height: 19px; color: var(--dsw-alias-label-secondary); }
.ia-body { flex: 1; min-height: 0; overflow-y: auto; scrollbar-gutter: stable; padding: 6px clamp(20px, 4vw, 48px) 48px; }
.ia-column { max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.ia-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ia-filters { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 3px; border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-2); border: 0.5px solid var(--dsw-alias-border-l1); }
.ia-filter { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: var(--dsw-radius-sm, 6px); cursor: pointer; white-space: nowrap; }
.ia-filter:disabled { opacity: 0.55; cursor: default; }
.ia-filter-active { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover-solid); }
.ia-filter-count { font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.ia-search { max-width: 240px; }
.ia-input { width: 100%; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-radius: var(--dsw-radius-md, 8px); padding: 7px 10px; font: inherit; font-size: 13px; }
.ia-input::placeholder { color: var(--dsw-alias-label-dimmed, var(--dsw-alias-label-secondary)); }
.ia-input:focus-visible { border-color: var(--dsw-alias-state-business-primary); }
.ia-textarea { resize: vertical; min-height: 64px; line-height: 1.5; }
.ia-page :focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.ia-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0.5px solid var(--dsw-alias-border-l4); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-radius: var(--dsw-radius-md, 8px); padding: 6px 12px; font: inherit; font-size: 13px; line-height: 18px; cursor: pointer; white-space: nowrap; }
.ia-btn:disabled { opacity: 0.45; cursor: default; }
.ia-btn-primary { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-label-primary-foreground); font-weight: 600; }
.ia-btn-danger { border-color: var(--dsw-alias-state-error-primary); }
.ia-btn-quiet { color: var(--dsw-alias-label-secondary); border-color: transparent; background: transparent; }
.ia-mini { border: none; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11.5px; line-height: 18px; padding: 2px 6px; border-radius: var(--dsw-radius-sm, 6px); cursor: pointer; }
.ia-mini:disabled { opacity: 0.45; cursor: default; }
.ia-confirm { display: inline-flex; align-items: center; gap: 4px; }
.ia-card { box-sizing: border-box; width: 100%; display: flex; flex-direction: column; gap: 6px; padding: 13px 16px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); cursor: pointer; }
.ia-list { display: flex; flex-direction: column; gap: 8px; }
.ia-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ia-card-title { font-size: 14px; font-weight: 600; line-height: 20px; overflow-wrap: anywhere; }
.ia-card-note { margin: 0; font-size: 13px; line-height: 19px; color: var(--dsw-alias-label-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ia-card-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.ia-muted { color: var(--dsw-alias-label-secondary); }
.ia-chip { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; border: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.ia-pill { display: inline-flex; align-items: center; gap: 5px; padding: 1px 9px; border-radius: 999px; border: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 11px; font-weight: 500; line-height: 17px; white-space: nowrap; }
.ia-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
.ia-pill-doing .ia-pill-dot { background: var(--dsw-alias-state-warn-primary); }
.ia-pill-done .ia-pill-dot { background: var(--dsw-alias-state-success-primary); }
.ia-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.ia-pad { padding: 18px 2px; }
.ia-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 48px 24px; border: 0.5px dashed var(--dsw-alias-border-l2); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); }
.ia-empty-title { margin: 6px 0 0; font-size: 14px; font-weight: 600; }
.ia-empty .ia-hint { max-width: 460px; margin: 0; }
.ia-empty .ia-btn { margin-top: 6px; }
.ia-footnote { margin: 4px 0 0; font-size: 11px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.ia-banner { position: sticky; top: 0; z-index: 3; display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; border-radius: var(--dsw-radius-md, 8px); font-size: 12.5px; line-height: 18px; border: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.ia-banner-dot { flex: none; width: 6px; height: 6px; margin-top: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); }
.ia-banner-error .ia-banner-dot { background: var(--dsw-alias-state-error-primary); }
.ia-banner-warn .ia-banner-dot { background: var(--dsw-alias-state-warn-primary); }
.ia-banner-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.ia-link-btn { border: none; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 16px; line-height: 1; padding: 0 3px; cursor: pointer; border-radius: var(--dsw-radius-sm, 6px); }
.ia-form { display: flex; flex-direction: column; gap: 14px; padding: 18px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); }
.ia-form-title { margin: 0; font-size: 15px; font-weight: 600; }
.ia-field { display: flex; flex-direction: column; gap: 6px; }
.ia-field-narrow { max-width: 280px; }
.ia-label { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.ia-form-error { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-primary); }
.ia-form-error::before { content: ''; display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: var(--dsw-alias-state-error-primary); vertical-align: 1px; }
.ia-form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 2px; }
.ia-file { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ia-hidden-input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.ia-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ia-back { border: none; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12.5px; cursor: pointer; padding: 4px 0; border-radius: var(--dsw-radius-sm, 6px); }
.ia-detail-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ia-detail-title { margin: 2px 0 0; font-size: 20px; line-height: 28px; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.ia-detail-title:focus { outline: none; }
.ia-detail-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ia-status-switch { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-2); border: 0.5px solid var(--dsw-alias-border-l1); }
.ia-status-switch .ia-filter { font-size: 11.5px; padding: 3px 8px; }
.ia-block { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); }
.ia-block-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.ia-block-title { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.01em; }
.ia-note { margin: 0; font-size: 14px; line-height: 22px; white-space: pre-wrap; overflow-wrap: anywhere; }
.ia-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ia-link-row { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.ia-link { color: var(--dsw-alias-link, var(--dsw-alias-brand-primary)); text-decoration: underline; text-underline-offset: 2px; font-size: 13px; overflow-wrap: anywhere; }
.ia-link-url { overflow-wrap: anywhere; }
.ia-link-row .ia-mini { margin-left: auto; }
.ia-link-row .ia-confirm { margin-left: auto; }
.ia-link-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ia-link-form .ia-input:nth-child(1) { flex: 2 1 180px; }
.ia-link-form .ia-input:nth-child(2) { flex: 1 1 140px; }
.ia-link-form .ia-btn { flex: none; }
.ia-log-actions { display: flex; align-items: center; gap: 8px; }
.ia-logs { display: flex; flex-direction: column; gap: 12px; }
.ia-log-wrap { display: flex; flex-direction: column; gap: 4px; }
.ia-log { border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-base); overflow: hidden; }
.ia-log-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 10px 14px; background: var(--dsw-alias-bg-layer-2); border-bottom: 0.5px solid var(--dsw-alias-border-l1); }
.ia-log-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ia-log-name { font-size: 12.5px; font-weight: 600; overflow-wrap: anywhere; }
.ia-log-foot { display: flex; justify-content: flex-end; align-items: center; gap: 6px; padding: 0 2px; }
.ia-turn { padding: 12px 14px; }
.ia-turn + .ia-turn { border-top: 0.5px solid var(--dsw-alias-border-l1); }
.ia-turn-user { background: var(--dsw-alias-bg-layer-2); box-shadow: inset 3px 0 0 var(--dsw-alias-link, var(--dsw-alias-brand-primary)); }
.ia-turn-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
.ia-speaker { font-size: 11px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.ia-turn-user .ia-speaker { color: var(--dsw-alias-link, var(--dsw-alias-brand-primary)); }
.ia-turn-text { font-size: 13px; line-height: 20px; white-space: pre-wrap; overflow-wrap: anywhere; }
.ia-turn-text strong { font-weight: 600; }
.ia-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: var(--dsw-alias-bg-layer-2); border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 4px; padding: 0 4px; }
.ia-raw { margin: 0; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 18px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 320px; overflow: auto; }
@media (hover: hover) {
  .ia-filter:hover:not(:disabled) { color: var(--dsw-alias-label-primary); }
  .ia-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
  .ia-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); border-color: transparent; }
  .ia-btn-quiet:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
  .ia-mini:hover:not(:disabled) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
  .ia-card:hover { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-border-l2); }
  .ia-link:hover { text-decoration-thickness: 2px; }
  .ia-back:hover { color: var(--dsw-alias-label-primary); }
  .ia-link-btn:hover:not(:disabled) { color: var(--dsw-alias-label-primary); }
}
@media (max-width: 767px) {
  .ia-search { max-width: none; flex: 1 1 160px; }
  .ia-toolbar { align-items: stretch; }
  .ia-field-narrow { max-width: none; }
  .ia-head { padding-top: calc(20px + var(--dsh-frame-top-clearance, 0px)); }
}
@media (pointer: coarse) {
  .ia-input { font-size: 16px; }
}
`

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { en: dictionaries.en, zh: dictionaries.zh }), 'idea-archive: dictionaries')
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          locale: NS,
          label: () => t('panel'),
        }, ArchiveIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, IdeaArchivePage))
      },
    }
  },
})

