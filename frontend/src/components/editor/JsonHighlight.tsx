function HighlightedLine({ line }: { line: string }) {
  const tokens: { text: string; cls: string }[] = []
  let rest = line

  const keyRe   = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:)/
  const strRe   = /^("(?:[^"\\]|\\.)*")/
  const numRe   = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/
  const boolRe  = /^(true|false|null)/
  const punctRe = /^([{}\[\],])/
  const spaceRe = /^(\s+)/

  while (rest.length > 0) {
    let m: RegExpMatchArray | null

    if ((m = rest.match(keyRe))) {
      tokens.push({ text: m[1], cls: '' })
      tokens.push({ text: m[2], cls: 'text-blue-500 dark:text-blue-300' })
      tokens.push({ text: m[3], cls: 'text-gray-500 dark:text-white/50' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(strRe))) {
      tokens.push({ text: m[1], cls: 'text-green-600 dark:text-green-400' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(numRe))) {
      tokens.push({ text: m[1], cls: 'text-orange-500 dark:text-orange-300' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(boolRe))) {
      tokens.push({ text: m[1], cls: 'text-purple-500 dark:text-purple-300' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(punctRe))) {
      tokens.push({ text: m[1], cls: 'text-gray-500 dark:text-white/50' })
      rest = rest.slice(m[0].length)
    } else if ((m = rest.match(spaceRe))) {
      tokens.push({ text: m[1], cls: '' })
      rest = rest.slice(m[0].length)
    } else {
      tokens.push({ text: rest[0], cls: 'text-gray-700 dark:text-white/70' })
      rest = rest.slice(1)
    }
  }

  return (
    <>
      {tokens.map((t, i) =>
        t.cls ? <span key={i} className={t.cls}>{t.text}</span> : <span key={i}>{t.text}</span>
      )}
    </>
  )
}

interface JsonHighlightProps {
  raw: string
}

export function JsonHighlight({ raw }: JsonHighlightProps) {
  const lines = raw.split('\n')
  return (
    <code className="block text-xs leading-6 font-mono">
      {lines.map((line, i) => (
        <span key={i} className="block">
          <span className="select-none inline-block w-10 text-right pr-4 text-gray-400 dark:text-white/20 border-r border-gray-200 dark:border-white/10 mr-4">
            {i + 1}
          </span>
          <HighlightedLine line={line} />
        </span>
      ))}
    </code>
  )
}
