import { type ReactNode } from 'react'

interface MarkdownTextProps {
  text: string
  className?: string
}

function renderInline(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))

    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${prefix}-c-${index++}`}
          className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-200"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(
        <strong key={`${prefix}-s-${index++}`} className="font-semibold text-zinc-50">
          {token.slice(2, -2)}
        </strong>,
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

const listItemPattern = /^\s*(?:[-*•+]|\d+\.)\s+/

/**
 * Renders a lightweight markdown subset (bullet/numbered lists, fenced code
 * blocks, inline code and bold) without an external dependency.
 */
export default function MarkdownText({ text, className }: MarkdownTextProps) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let blockId = 0

  while (i < lines.length) {
    const line = lines[i]
    const blockKey = `b${blockId++}`

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // consume the closing fence
      blocks.push(
        <pre
          key={blockKey}
          className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-200"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // List block
    if (listItemPattern.test(line)) {
      const items: ReactNode[] = []
      let itemId = 0
      while (i < lines.length && listItemPattern.test(lines[i])) {
        const content = lines[i].replace(listItemPattern, '')
        const key = `${blockKey}-li-${itemId++}`
        items.push(
          <li key={key} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
            <span>{renderInline(content, key)}</span>
          </li>,
        )
        i++
      }
      blocks.push(
        <ul key={`${blockKey}-ul`} className="space-y-1.5">
          {items}
        </ul>,
      )
      continue
    }

    // Paragraph
    blocks.push(
      <p key={blockKey} className="leading-relaxed">
        {renderInline(line, blockKey)}
      </p>,
    )
    i++
  }

  if (blocks.length === 0) return null

  return <div className={className ?? 'space-y-2 text-sm leading-relaxed text-zinc-200'}>{blocks}</div>
}
