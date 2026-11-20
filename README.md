# Idea archive

Keeps the projects you explored for five or ten minutes so you can come back to
them later. Each idea holds:

- your own thought about the project, plus an optional time estimate;
- the research links you collected;
- the chat logs you saved from a research session, such as a duck.ai export.
  duck.ai transcripts are parsed into questions and answers so the discoveries
  stay readable when you start the project.

## Install

Copy this directory somewhere permanent, then in DeepSeek Harness open
**Plugins**, choose **Add plugin**, and install this directory. Enable the
bundle when the plugin manager offers it. There is no build step: the Host half
and the browser page are plain ES modules.

## Where to find it

After the bundle is enabled, open **Idea archive** from the archive icon in the
left sidebar. The page lists every idea, filters by state, searches titles,
notes, and links, and opens one idea with its links and full transcripts.

The agent also has these tools: `idea_save`, `idea_list`, `idea_get`,
`idea_add_links`, and `idea_attach_log`. While you research, you can ask it to
save the idea and attach the downloaded chat log for you.

## Where the data lives

Everything stays on this machine:

```
$DSH_HOME/idea-archive/ideas.json      # the indexed ideas
$DSH_HOME/idea-archive/logs/<idea>/    # one .txt file per attached chat log
```

`$DSH_HOME` defaults to `~/.dsh`. Removing the bundle hides the page and its
tools but does not delete these files; reinstalling it shows the same archive
again.

## Limits

- Chat logs are stored as text; the attach control and the agent tool accept
  files up to 4 MiB.
- A duck.ai export is recognized by its `User prompt N of M` question headers.
  Any other text file is kept and shown verbatim.
- The archive is local to this DSH home; it is not synced between machines.
