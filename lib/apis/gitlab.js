import { fetchAll, getNextLink, fetchLinkJSON } from '../fetch.js'

export const defaultHeaders = new Headers({
})

const API_ENDPOINTS = {
  gitlab: 'https://gitlab.com',
  silence: 'https://git.silence.dev', // https://git.silence.dev/api/v4/groups/${org}/projects?per_page=25
}

export async function listRepos(user) {
  let repoList = await getUserRepos(user)

  if (repoList?.length === 0) {
    repoList = await getOrgRepos(user)
  }

  return repoList
}

export async function getUserRepos(user) {
  let opts = {
    method: 'GET',
    headers: defaultHeaders,
  }

  return await fetchAll(
    `${API_ENDPOINTS.gitlab}/api/v4/users/${user}/projects?per_page=100`,
    opts
  )
}

export async function getOrgRepos(org) {
  let opts = {
    method: 'GET',
    headers: defaultHeaders,
  }

  return await fetchAll(
    `${API_ENDPOINTS.gitlab}/api/v4/groups/${org}/projects?per_page=100`,
    opts
  )
}

export async function getBits(user) {
  // At present time (2023-03-30), it appears there is no way of
  // getting a list of snippets for a specific user in JSON format

  // We could get a HTML version of it like so
  // `${API_ENDPOINTS.gitlab}/users/${user}/snippets`
  // note the lack of /api/v4

  // let opts = {
  //   method: 'GET',
  //   headers: defaultHeaders,
  // }

  // return await fetchAll(
  //   `${API_ENDPOINTS.gitlab}/api/v4/users/${user}/snippets?per_page=100`,
  //   opts
  // )
  return await []
}

export async function getBit(id) {
  let opts = {
    method: 'GET',
    headers: defaultHeaders,
  }

  let request = await fetch(
    `${API_ENDPOINTS.gitlab}/api/v4/snippets/${id}`,
    opts
  )

  return await request?.json()
}

export function confineResult({
  id,
  name,
  path_with_namespace,
  description,
  mirror,
  default_branch,
  ssh_url_to_repo,
  http_url_to_repo,
  web_url,
  created_at,
  last_activity_at,
}) {
  let repoUrl
  let repoPath
  let repoUser
  let repoName

  if (!path_with_namespace && web_url) {
    repoUrl = new URL(web_url)
    repoPath = repoUrl.pathname.substring(1).split('.git')[0]
    let unwrap = repoPath?.split('/')
    repoUser = unwrap[0]
    repoName = unwrap[1]

    path_with_namespace = `${repoUser}/${repoName}`
  }

  // if (!clone_url && git_pull_url) {
  //   clone_url = git_pull_url
  // }

  return {
    id,
    name,
    clone_url: http_url_to_repo,
    html_url: web_url,
    mirror_url: mirror || null,
    full_name: path_with_namespace,
    description,
    created_at,
    updated_at: last_activity_at,
    pushed_at: last_activity_at,
    git_url: http_url_to_repo,
    ssh_url: ssh_url_to_repo,
    fork: false, // gitlab does not show if its a fork
  }
}
