import * as core from '@actions/core'
import { Octokit } from 'octokit'
import * as toolCache from '@actions/tool-cache'
import * as github from '@actions/github'
import type { BuildlessSetupActionOptions as Options } from './options'
import { GITHUB_DEFAULT_HEADERS, OS } from './config'
import { obtainVersion } from './command'

const downloadBase = 'https://dl.less.build'
const downloadPathV1 = 'cli'

/**
 * Version info resolved for a release of Buildless.
 */
export type BuildlessVersionInfo = {
  // Name of the release, if available.
  name?: string

  // String identifying the version tag.
  tag_name: string

  // Whether this version is resolved (`false`) or user-provided (`true`).
  userProvided: boolean
}

/**
 * Release archive type.
 */
export enum ArchiveType {
  // Release is compressed with `gzip`.
  GZIP = 'gzip',

  // Release is compressed with `zip`.
  ZIP = 'zip'
}

/**
 * Information about an Buildless release.
 */
export type BuildlessRelease = {
  // Resolved version, from fetching the latest version, or from the user's provided version.
  version: BuildlessVersionInfo

  // Path to the installed binary.
  path: string

  // Folder holding the binary, which is appended to the PATH.
  home: string

  // Deferred cleanup or after-action method.
  deferred?: () => Promise<void>
}

/**
 * Describes downloaded and cached tool info.
 */
export interface DownloadedToolInfo {
  url: URL
  tarballPath: string
  archiveType: ArchiveType
}

/**
 * Build a download URL for a Buildless release; if a custom URL is provided as part of the set of
 * `options`, use it instead.
 *
 * @param version Version we are downloading.
 * @param options Effective options.
 * @return URL and archive type to use.
 */
function buildDownloadUrl(
  options: Options,
  version: BuildlessVersionInfo
): { url: URL; archiveType: ArchiveType } {
  let ext = 'tgz'
  let archiveType = ArchiveType.GZIP
  /* istanbul ignore next */
  if (options.os === OS.WINDOWS) {
    ext = 'zip'
    archiveType = ArchiveType.ZIP
  }
  const arch = options.arch.replaceAll('aarch64', 'arm64')

  return {
    archiveType,
    url: new URL(
      // https://... / cli / (version) / (os)-(arch) / cli.(extension)
      `${downloadBase}/${downloadPathV1}/${version.tag_name}/${options.os}-${arch}/cli.${ext}`
    )
  }
}

/**
 * Unpack a release archive.
 *
 * @param archive Path to the archive.
 * @param toolHome Unpack target.
 * @param archiveType Type of archive to unpack.
 * @param options Options which apply to this action run.
 * @return Path to the unpacked release.
 */
async function unpackRelease(
  archive: string,
  toolHome: string,
  archiveType: ArchiveType,
  options: Options
): Promise<string> {
  let target: string
  try {
    /* istanbul ignore next */
    if (options.os === OS.WINDOWS) {
      core.debug(
        `Extracting as zip on Windows, from: ${archive}, to: ${toolHome}`
      )
      target = await toolCache.extractZip(archive, toolHome)
    } else {
      switch (archiveType) {
        // extract as zip
        /* istanbul ignore next */
        case ArchiveType.ZIP:
          core.debug(
            `Extracting as zip on Unix or Linux, from: ${archive}, to: ${toolHome}`
          )
          target = await toolCache.extractZip(archive, toolHome)
          break

        // extract as tgz
        case ArchiveType.GZIP:
          core.debug(
            `Extracting as tgz on Unix or Linux, from: ${archive}, to: ${toolHome}`
          )
          target = await toolCache.extractTar(archive, toolHome)
          break
      }
    }
  } catch (err) {
    /* istanbul ignore next */
    core.warning(`Failed to extract Buildless release: ${err}`)
    target = toolHome
  }
  return target
}

/**
 * Fetch the latest Buildless release from GitHub.
 *
 * @param token GitHub token active for this workflow step.
 */
export async function resolveLatestVersion(
  token?: string
): Promise<BuildlessVersionInfo> {
  /* istanbul ignore next */
  const octokit = token ? github.getOctokit(token) : new Octokit({})
  core.debug(`Fetching latest CLI releases...`)
  const latest = await octokit.request(
    'GET /repos/{owner}/{repo}/releases/latest',
    {
      owner: 'buildless',
      repo: 'cli',
      headers: GITHUB_DEFAULT_HEADERS
    }
  )

  /* istanbul ignore next */
  if (!latest) {
    throw new Error('Failed to fetch the latest Buildless version')
  }
  /* istanbul ignore next */
  const name = latest.data?.name || undefined
  return {
    name,
    tag_name: latest.data.tag_name,
    userProvided: !!token
  }
}

/**
 * Conditionally download the desired version of Buildless, or use a cached version, if available.
 *
 * @param version Resolved version info for the desired copy of Buildless.
 * @param options Effective setup action options.
 */
async function maybeDownload(
  version: BuildlessVersionInfo,
  options: Options
): Promise<BuildlessRelease> {
  // build download URL, use result from cache or disk
  const { url, archiveType } = buildDownloadUrl(options, version)
  core.info(`Installing from URL: ${url} (type: ${archiveType})`)

  let targetBin = `${options.target}/buildless`

  /* istanbul ignore next */
  if (options.os === OS.WINDOWS) {
    targetBin = `${options.target}\\buildless.exe`
  }

  // build resulting tarball path and resolved tool info
  let binPath: string = targetBin
  /* istanbul ignore next */
  const binHome: string = options.target
  let toolDir: string | null = null

  try {
    toolDir = toolCache.find('buildless', version.tag_name, options.arch)
  } catch (err) {
    /* istanbul ignore next */
    core.debug(`Buildless not in tool cache: ${err}`)
  }
  if (toolDir) {
    core.debug(`Buildless found in tool cache: ${toolDir}`)
  }
  /* istanbul ignore next */
  if (options.cache && toolDir) {
    // we have an existing cached copy of buildless
    core.debug('Caching enabled and cached Buildless release found; using it')
    binPath = toolDir
  } else {
    /* istanbul ignore next */
    if (!options.cache) {
      core.debug(
        'Cache disabled; forcing a fetch of the specified Buildless release'
      )
    } else {
      core.debug('Cache enabled but no hit was found; downloading release')
    }

    // we do not have an existing copy; download it
    let toolArchive: string | null = null
    try {
      toolArchive = await toolCache.downloadTool(url.toString())
    } catch (err) {
      /* istanbul ignore next */
      core.error(`Failed to download Buildless release: ${err}`)
      /* istanbul ignore next */
      if (err instanceof Error)
        core.setFailed(
          'Failed to download Buildless release at specified version'
        )
      /* istanbul ignore next */
      throw err
    }

    core.debug(`Buildless release downloaded to: ${toolArchive}`)
    await unpackRelease(toolArchive, binHome, archiveType, options)
  }

  return {
    version,
    home: binHome,
    path: binPath
  }
}

/**
 * Fetch a download link for the specified Buildless version; if the version is `latest`, fetch
 * the download link which matches for the latest release.
 *
 * @param options Canonical suite of options to use for this action instance.
 */
export async function downloadRelease(
  options: Options
): Promise<BuildlessRelease> {
  core.startGroup(
    `Resolving Buildless release '${options.version || 'latest'}'`
  )

  if (options.custom_url) {
    // if we're using a custom URL, download it based on that token
    try {
      core.debug(`Downloading custom archive: ${options.custom_url}`)
      const customArchive = await toolCache.downloadTool(options.custom_url)

      // sniff archive type from URL
      let archiveType: ArchiveType = ArchiveType.GZIP
      /* istanbul ignore next */
      if (options.custom_url.endsWith('.zip')) {
        archiveType = ArchiveType.ZIP
      }

      /* istanbul ignore next */
      let targetDir: string = options.target
      targetDir = await unpackRelease(
        customArchive,
        targetDir,
        archiveType,
        options
      )
      /* istanbul ignore next */
      const binPath =
        options.os === OS.WINDOWS
          ? `${targetDir}\\buildless.exe`
          : `${targetDir}/buildless`

      return {
        version: {
          tag_name: await obtainVersion(binPath),
          userProvided: true
        },
        home: targetDir,
        path: binPath
      }
    } catch (err) {
      /* istanbul ignore next */
      core.error(`Failed to download custom release: ${err}`)
      /* istanbul ignore next */
      if (err instanceof Error) core.setFailed(err)
      /* istanbul ignore next */
      throw err
    }
  } else {
    // resolve applicable version
    let versionInfo: BuildlessVersionInfo
    if (options.version === 'latest') {
      core.debug('Resolving latest version via GitHub API')
      versionInfo = await resolveLatestVersion(options.token)
    } else {
      /* istanbul ignore next */
      versionInfo = {
        tag_name: options.version,
        userProvided: true
      }
    }

    // setup caching with the effective version and perform download
    const result = maybeDownload(versionInfo, options)
    core.endGroup()
    return result
  }
}
