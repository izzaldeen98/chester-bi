import { FileJson, File as FileLucide } from 'lucide-react'

interface FileIconProps {
  filename: string
  active?: boolean
}

export function FileIcon({ filename, active = false }: FileIconProps) {
  const cls = active ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-400 dark:text-white/40'
  if (filename.endsWith('.json'))
    return <FileJson className={`w-4 h-4 ${cls}`} />
  if (filename.endsWith('.malloy'))
    return <FileLucide className={`w-4 h-4 ${active ? 'text-purple-400' : 'text-purple-400/50'}`} />
  return <FileLucide className={`w-4 h-4 ${cls}`} />
}

export function fileLang(filename: string): string {
  if (filename.endsWith('.malloy')) return 'Malloy'
  if (filename.endsWith('.json'))   return 'JSON'
  return 'Text'
}
