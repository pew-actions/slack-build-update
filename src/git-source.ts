import * as gcm from 'checkout/src/git-command-manager'
import * as gitSourceSettings from 'checkout/src/git-source-settings'
import * as workflowContextHelper from 'checkout/src//workflow-context-helper'
import * as gitSourceProvider from 'checkout/src/git-source-provider'
import * as path from 'path'

export type GetSourceOpts = {
  repository: string
  token: string
  path: string
  ref: string
}

export async function getSource(opts: GetSourceOpts) : Promise<gcm.IGitCommandManager> {

  const repositoryParts = opts.repository.split('/')
  if (repositoryParts.length !== 2) {
    throw new Error('Repository must be in `<owner>/<repo>` format')
  }

  const sourceSettings : gitSourceSettings.IGitSourceSettings = {
    provider: 'github',
    repositoryPath: path.join(process.cwd(), opts.path),
    repositoryOwner: repositoryParts[0],
    repositoryName: repositoryParts[1],
    ref: opts.ref,
    commit: '',
    clean: true,
    cleanExclude: [],
    postClean: false,
    filter: undefined,
    sparseCheckout: [],
    sparseCheckoutConeMode: true,
    fetchDepth: 0,
    fetchTags: false,
    showProgress: true,
    lfs: false,
    lfsurl: '',
    gcFirst: false,
    lfsCredProvider: 'github',
    submodules: false,
    nestedSubmodules: false,
    authToken: opts.token,
    sshKey: '',
    sshKnownHosts: '',
    sshStrict: true,
    sshUser: 'git',
    persistCredentials: true,
    workflowOrganizationId: await workflowContextHelper.getOrganizationId(),
    setSafeDirectory: false,
    githubServerUrl: '',
    longpaths: true,
  }

  await gitSourceProvider.getSource(sourceSettings)
  const git = await gitSourceProvider.getGitCommandManager(sourceSettings)
  if (!git) {
    throw new Error('Failed to create git command manager')
  }

  await git.execGit(['config', '--local', 'user.name', 'Build Machine'], false, false, {})
  await git.execGit(['config', '--local', 'user.email', 'builds@playeveryware.com'], false, false, {})

  return git!
}
