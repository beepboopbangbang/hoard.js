export function getNextLink(link) {
  return link?.match(
    /<([^>]+)>;\s*rel="next"/
  )?.[1]
}

export async function fetchLinkJSON(url, opts) {
  let request = await fetch(url, opts)
  let next = getNextLink(request.headers.get('link'))
  let result = request.ok ? await request?.json() : await []

  return {
    request,
    result,
    next
  }
}

export async function fetchAll(url, opts) {
  let fullResult = []
  let nextLink

  // let bleh = await Promise.allSettled()

  return new Promise(async (resolve, reject) => {
    let { result, next } = await fetchLinkJSON(url, opts)
    nextLink = next

    // console.log('fetchAll nextLink', nextLink)

    fullResult = result

    while (nextLink) {
      let { result, next } = await fetchLinkJSON(nextLink, opts)
      nextLink = next

      // console.log('fetchAll while nextLink', nextLink)

      fullResult = [
        ...fullResult,
        ...result,
      ]
    }

    resolve(fullResult)
  })
}