import { fetchAll, getNextLink, fetchLinkJSON } from '../fetch.js'

const defaultHeaders = new Headers({
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

const API_ENDPOINTS = {
  github: 'https://api.github.com',
}

export async function listRepos(user) {
  let repoList = await getUserRepos(user)

  if (repoList?.length === 0) {
    repoList = await getOrgRepos(user)
  }

  // if (repoList?.length === 0) {
  //   repoList = await getBits(user)
  // }

  return repoList
}

export async function getUserRepos(user) {
  let opts = {
    method: 'GET',
    headers: defaultHeaders,
  }

  return await fetchAll(
    `${API_ENDPOINTS.github}/users/${user}/repos?type=sources&per_page=100`,
    opts
  )
}

export async function getOrgRepos(org) {
  let opts = {
    method: 'GET',
    headers: defaultHeaders,
  }

  return await fetchAll(
    `${API_ENDPOINTS.github}/orgs/${org}/repos?per_page=100&type=sources`,
    opts
  )
}

export async function getBits(user, repo) {
  let opts = {
    method: 'GET',
    headers: defaultHeaders,
  }

  if (!repo) {
    let gistInfo = await getBit(user)
    repo = user
    user = gistInfo?.owner?.login
    // console.log('GIST User & Repo', user, repo, gistInfo)
  }

  return await fetchAll(
    `${API_ENDPOINTS.github}/users/${user}/gists?per_page=100&type=sources`,
    opts
  )
}

export async function getBit(id) {
  let opts = {
    method: 'GET',
    headers: defaultHeaders,
  }

  let request = await fetch(
    `${API_ENDPOINTS.github}/gists/${id}`,
    opts
  )

  return await request?.json()
}

export function confineResult({
  id,
  node_id,
  name,
  files,
  clone_url,
  git_pull_url,
  html_url,
  full_name,
  description,
  created_at,
  updated_at,
  pushed_at,
  mirror_url,
  git_url,
  ssh_url,
  fork,
}) {
  let repoUrl
  let repoPath
  let repoUser
  let repoName

  if (!full_name && html_url) {
    repoUrl = new URL(html_url)
    repoPath = repoUrl.pathname.substring(1).split('.git')[0]
    let unwrap = repoPath?.split('/')
    repoUser = unwrap[0]
    repoName = unwrap[1]

    full_name = `${repoUser}/${repoName}`
  }

  if (!clone_url && git_pull_url) {
    clone_url = git_pull_url
  }

  return {
    id,
    node_id,
    name,
    files,
    clone_url,
    html_url,
    mirror_url,
    full_name,
    description,
    created_at,
    updated_at,
    pushed_at,
    git_url,
    ssh_url,
    fork,
  }
}