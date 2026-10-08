import { stripVTControlCharacters } from 'node:util'

export function hasServerAddress(output, url) {
  // Vite colors can split the visible URL into multiple terminal sequences.
  return stripVTControlCharacters(output).includes(url)
}
