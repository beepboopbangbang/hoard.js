export const regexUrlGit = /^((git|ssh|http(s)?)|(git@[\w.]+))(:(\/\/)?)([\w.@:/\-~]+)(?:\.git)?(\/)?$/i;
export const regexUrlGithub = /^((?:(?:git@?|ssh|http(?:s)?)(:(\/\/)?))(github.com)):?\/?([\w:\-~]+)\/?([\w:\-~]+)(?:\.git)?\/?$/i
export const regexUrlGitlab = /^((?:(?:git@?|ssh|http(?:s)?)(:(\/\/)?))(gitlab.com)):?\/?([\w:\-~]+)\/?([\w:\-~]+)(?:\.git)?\/?$/i
export const regexUrlGithublab = /^((?:(?:git@?|ssh|http(?:s)?)(:(\/\/)?))((?:git(?:hub|lab)).com)):?\/?([\w:\-~]+)\/?([\w:\-~]+)(?:\.git)?\/?$/i
export const regexUrlDomain = domain => new RegExp(`^((?:(?:git@?|ssh|http(?:s)?)(:(\\/\\/)?))(${domain})):?\\/?([\\w:\\-~]+)\\/?([\\w:\\-~]+)(?:\\.git)?\\/?$`, 'ig');

/**
 * @param {Array<any>} arr
 * @param {any} item
 */
export function removeItem(arr, item) {
  let index = arr.indexOf(item);
  if (index >= 0) {
    return arr.splice(index, 1)[0];
  }
  return null;
}

/**
 * Remove any of these items contained in array
 * and return true or false if items were found
 *
 * @example
 *   let contains = removeItems(['a', 'b', 'c'], ['x', 'b'])
 *   // contains === true
 *   let contains = removeItems(['a', 'b', 'c'], ['x', 'y', 'z'])
 *   // contains === false
 *
 * @param {string[]} haystack Haystack
 * @param {string[]} needles Needles
 *
 * @returns {boolean} At least one of Needles exist in Haystack
 */
export function removeItems(haystack, needles) {
  let found = []

  for (let needle of needles) {
    let eye = haystack.indexOf(needle)
    if (eye > -1) {
      found.push(haystack.splice(eye, 1)[0])
      continue
    }
  }

  return found.length > 0
}

/**
 * Find any needles contained in haystack, remove from haystack
 * and return pin cushion with needles & thread
 *
 * @example
 *   let contains = captureItems(['a', 'b', 'c'], ['x', 'b'])
 *   // contains === true
 *   let contains = captureItems(['a', 'b', 'c'], ['x', 'y', 'z'])
 *   // contains === false
 *
 * @param {string[]} haystack Haystack
 * @param {string[]} needles Needles
 * @param {string} [stitch] Stitch
 *
 * @returns {Array} Pin cushion with needles & thread
 */
export function captureItems(haystack, needles, stitch) {
  stitch = stitch?.trim()

  let pincushion = []

  for (let needle of needles) {
    for (let hay in haystack) {
      if (haystack[hay].includes(needle)) {
        if ('undefined' !== typeof stitch) {
          // haystack = ['a','b=c','d']
          // hay = 'b=c'
          // if stitch is an '='
          // split hay by stitch
          // pincushion push ['b','c']
          // haystack = ['a','d']
          if (stitch !== '' && haystack[hay].includes(stitch)) {
            pincushion.push(haystack.splice(hay, 1)[0].split(stitch))
            continue
          }

          // otherwise get the next item after this one
          // haystack = ['a','b','c','d']
          // hay = 'b'
          // pincushion push ['b','c']
          // haystack = ['a','d']
          pincushion.push(haystack.splice(hay, 2))
          continue
        }

        pincushion.push(haystack.splice(hay, 1)[0])
        // break
      }
    }
  }

  return pincushion
}

/**
 * Array contains any
 *
 * @example
 *   let contains = containsAny(['a', 'b', 'c'], ['x', 'b'])
 *   // contains === true
 *   let contains = containsAny(['a', 'b', 'c'], ['x', 'y', 'z'])
 *   // contains === false
 *
 * @param {string[]} hay Haystack
 * @param {string[]} needles Needles
 *
 * @returns {boolean} At least one of Needles exist in Haystack
 */
export function containsAny(hay, needles) {
  let found = false

  for (let needle of needles) {
    if (hay.includes(needle)) {
      found = true
      break
    }
  }

  return found
}

/**
 * Split string at specific length
 * https://stackoverflow.com/a/29202760
 *
 * @example
 *   let contains = chunkSubstr('this is a string', 4)
 *   // contains === true
 *
 * @param {string[]} str String
 * @param {string[]} size Maximum length
 *
 * @returns {string[]} Array of strings at size or smaller
 */
export function chunkSubstr(str, size) {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substr(o, size)
  }

  return chunks
}