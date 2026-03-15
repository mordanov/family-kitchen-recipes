import { readFileSync } from 'node:fs'

export function loadBrowserScript(relativePath, globalName) {
  const fileUrl = new URL(relativePath, import.meta.url)
  let source = readFileSync(fileUrl, 'utf8')

  if (globalName) {
    source = source.replace(
      new RegExp(`const\\s+${globalName}\\s*=`),
      `window.${globalName} =`
    )
  }

  source = source.replace(
    /document\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*App\.init\(\)\);?/g,
    ''
  )

  window.eval(`${source}\n//# sourceURL=${fileUrl.pathname}`)

  return window[globalName]
}

