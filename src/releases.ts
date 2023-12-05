import * as core from '@actions/core'
import * as io from '@actions/io'
import * as exec from '@actions/exec'
import { Octokit } from 'octokit'
import * as toolCache from '@actions/tool-cache'
import * as github from '@actions/github'
import * as http from '@actions/http-client'
import type { BuildlessSetupActionOptions as Options } from './options'
import { obtainVersion } from './command'
import { error as sendError } from './diagnostics'
import {
  GITHUB_DEFAULT_HEADERS,
  OS,
  BUILDLESS_DOWNLOAD_ENDPOINT as downloadBase,
  BUILDLESS_CLI_ENDPOINT as cliApiBase,
  httpClient
} from './config'

const downloadPathV1 = 'cli'

const ENABLE_XZ = false

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

type TargetVariantString =
  | 'darwin-amd64'
  | 'darwin-arm64'
  | 'linux-amd64'
  | 'windows-amd64'
  | string

/** Shape of information about a single release variant. */
interface ReleaseVariantInfo {
  downloadUrl: URL
  digestUrl: URL
  digest?: string
}

/** Shape of JSON version info for a CLI release. */
interface ReleaseVersionInfo {
  version: string

  variants: {
    [key: TargetVariantString]: ReleaseVariantInfo
  }
}

/**
 * Release archive type.
 */
export enum ArchiveType {
  // Release is a tarball compressed with `gzip`.
  GZIP = 'gzip',

  // Release is a tarball compressed with `xz`.
  XZ = 'xz',

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
 * @param archiveType Type of archive to download.
 * @return URL and archive type to use.
 */
function buildDownloadUrl(
  options: Options,
  version: BuildlessVersionInfo,
  archiveType = ArchiveType.GZIP
): { url: URL; archiveType: ArchiveType } {
  let ext: string
  switch (archiveType) {
    case ArchiveType.GZIP:
      ext = 'tgz'
      break
    case ArchiveType.XZ:
      ext = 'txz'
      break
    case ArchiveType.ZIP:
      ext = 'zip'
      break
  }

  // fixup: `arm64` -> `aarch64`
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
  try {
    /* istanbul ignore next */
    if (options.os === OS.WINDOWS) {
      core.debug(
        `Extracting as zip on Windows, from: ${archive}, to: ${toolHome}`
      )
      return await toolCache.extractZip(archive, toolHome)
    } else {
      if (archiveType === ArchiveType.ZIP) {
        core.debug(
          `Extracting as zip on Unix or Linux, from: ${archive}, to: ${toolHome}`
        )
        return await toolCache.extractZip(archive, toolHome)
      } else if (archiveType === ArchiveType.XZ) {
        core.debug(
          `Extracting txz on Unix or Linux, from: ${archive}, to: ${toolHome}`
        )
        // decompress with xz, located via `io.where`
        const xzbin = await io.which('xz', true)
        if (!xzbin) {
          console.error(
            'Failed to find `xz` tool: falling back to gzip archive.'
          )
          throw new Error('INVALID_COMPRESSION_TOOL')
        }
        // rename it to `.tar.xz` to make xz happy
        const archiveBasename = archive.replace(/\.txz$/, '')
        const targetArchive = `${archiveBasename}.tar.xz`
        core.debug(`Renaming archive: from=${archive} to=${targetArchive}`)
        await io.mv(archive, targetArchive)

        // call `exec` on `xz` to decompress the tarball in place
        await exec.exec(xzbin, ['-vd', targetArchive])

        // now we should have a file at `{name}.tar` instead of `{name}.txz`
        const tarball = `${archiveBasename}.tar`
        core.debug(`Extracting decompressed tarball: ${tarball}`)
        return toolCache.extractTar(tarball, toolHome, 'x')
      } else if (archiveType === ArchiveType.GZIP) {
        core.debug(
          `Extracting as tgz on Unix or Linux, from: ${archive}, to: ${toolHome}`
        )
        return toolCache.extractTar(archive, toolHome)
      }
    }
  } catch (err) {
    // report the error
    await sendError(err)

    /* istanbul ignore next */
    core.warning(`Failed to extract Buildless release: ${err}`)
    core.setFailed('Failed to extract Buildless release')
  }
  throw new Error('RELEASE_EXTRACT_FAILED')
}

/**
 * Fetch the latest Buildless release from GitHub.
 *
 * @param token GitHub token active for this workflow step.
 */
export async function resolveLatestVersion(
  token?: string
): Promise<BuildlessVersionInfo> {
  const githubFallback = async (): Promise<BuildlessVersionInfo> => {
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
    core.info(`Fetched latest version via GitHub API: ${latest.data.tag_name}`)

    /* istanbul ignore next */
    const name = latest.data?.name || undefined
    return {
      name,
      tag_name: latest.data.tag_name,
      userProvided: false
    }
  }
  try {
    // try downloading first via CLI API
    const reqHeaders = {
      [http.Headers.Accept]: http.MediaTypes.ApplicationJson
    }
    const jsonObj = await httpClient.getJson<ReleaseVersionInfo>(
      `${cliApiBase}/version`,
      reqHeaders
    )
    const info = jsonObj.result

    if (jsonObj.statusCode === 200 && info) {
      core.info(`Fetched latest version via CLI API: ${info.version}`)
      return {
        tag_name: info.version,
        userProvided: false
      }
    } else {
      core.debug(
        `Failed to fetch latest version via CLI API; got status: ${jsonObj.statusCode}.`
      )
    }
  } catch (err) {
    const msg = (err as Error)?.message || '(none)'
    core.debug(
      `Failed to fetch latest version via CLI API; falling back to Github API. Error: "${msg}".`
    )
  }
  return githubFallback()
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
  // decide on an archive type
  let defaultArchiveType = ArchiveType.GZIP // default
  if (options.os === OS.WINDOWS) {
    defaultArchiveType = ArchiveType.ZIP
  }

  if (ENABLE_XZ) {
    // check for `xz` support, use it if we can, the archives are smaller
    try {
      await io.which('xz', true)
      defaultArchiveType = ArchiveType.XZ
      core.debug(`Tool 'xz' found; using xz-based archives.`)
    } catch (err) {
      /* istanbul ignore next */
      core.debug(
        'Tool `xz` is not available on the host system; falling back to gzip archives.'
      )
      defaultArchiveType = ArchiveType.GZIP
    }
  }

  // build download URL, use result from cache or disk
  const { url, archiveType } = buildDownloadUrl(
    options,
    version,
    defaultArchiveType
  )
  core.debug(`Installing from URL: ${url} (type: ${archiveType})`)

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
  if (!options.skip_cache && toolDir) {
    // we have an existing cached copy of buildless
    core.debug(
      'Tool caching enabled and cached Buildless release found; using it'
    )
    binPath = toolDir
  } else {
    /* istanbul ignore next */
    if (!options.skip_cache) {
      core.debug(
        'Tool cache disabled; forcing a fetch of the specified Buildless release'
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
      core.debug(
        `Failed to download Buildless release: ${err} (target: ${url})`
      )
      /* istanbul ignore next */
      if (err instanceof Error) {
        // report the error and fail the run
        await sendError(err)
      }
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
  core.info(`Resolving Buildless release '${options.version || 'latest'}'`)

  if (options.custom_url) {
    // if we're using a custom URL, download it based on that token
    try {
      core.info(`Downloading custom archive: ${options.custom_url}`)
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
      if (err instanceof Error) {
        // report the error and fail the workflow
        await sendError(err)
        core.setFailed(err)
      }
      /* istanbul ignore next */
      throw err
    }
  } else {
    // resolve applicable version
    let versionInfo: BuildlessVersionInfo
    if (options.version === 'latest') {
      core.info('Resolving latest version via GitHub API')
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
