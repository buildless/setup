
# GitHub Action: Setup Buildless

[![CI](https://github.com/buildless/setup-buildless/actions/workflows/ci.yml/badge.svg)](https://github.com/buildless/setup-buildless/actions/workflows/ci.yml)

This repository provides a [GitHub Action][0] to setup [Buildless][1] within your workflows. Supported features:

- **Buildless CLI:** Install and authorize the Buildless CLI
- **Buildless Agent:** Install and run the near-caching Buildless Agent

## Usage

**Install the latest Buildless CLI, add it to the `PATH`, and run the agent**
```yaml
  - name: "Setup: Buildless"
    uses: buildless/setup-buildless@v1
```

**Install the latest Buildless CLI, add it to the `PATH`, without the agent:**
```yaml
  - name: "Setup: Buildless"
    uses: buildless/setup-buildless@v1
    with:
      agent: false  # you really should use the agent tho
```

## Authorization

The CLI and Agent will both **automatically use `BUILDLESS_APIKEY`**, if present, to authorize cache traffic and cloud backhaul.
If no authorization material is present, only local caching is enabled.

Sign up for a [Buildless Cloud][1] account to obtain an API key. It's free to start.

## Options

The full suite of available options are below.

| Option        | Type         | Default                        | Description                                  |
| ------------- | ------------ | ------------------------------ | -------------------------------------------- |
| `version`     | `string`     | `latest`                       | Version to install; defaults to `latest`     |
| `os`          | `string`     | (Current)                      | OS to target; defaults to current platform   |
| `arch`        | `string`     | (Current)                      | Arch to target; defaults to current platform |
| `agent`       | `boolean`    | `true`                         | Install and start the Buildless Agent        |
| `apikey`      | `string`     | `${{ env.BUILDLESS_API_KEY }}` | Perform a self-test after installing         |
| `token`       | `string`     | `${{ env.GITHUB_TOKEN }}`      | GitHub token to use for fetching assets      |
| `export_path` | `boolean`    | `true`                         | Whether to install Buildless onto the `PATH` |

**Options for `os`** (support varies)
- `darwin`, `mac`, `macos`
- `windows`, `win32`
- `linux`

**Options for `arch`** (support varies)
- `amd64`, `x64`, `x86_64`
- `arm64`, `aarch64`

**Full configuration sample with defaults**
```yaml
  - name: "Setup: Buildless"
    uses: buildless/setup-buildless@v1
    with:
      version: latest
      os: linux
      arch: amd64
      agent: true
      apikey: ${{ env.BUILDLESS_API_KEY || secrets.BUILDLESS_API_KEY }}
      token: ${{ env.GITHUB_TOKEN }}
      export_path: true
```

## What is Buildless?

[Buildless][0] is a build caching system which works with most build tools. If you have a build tool that supports remote caching, Buildless can
probably plug right in, and it makes development fast and fun.

Supported language ecosystems and toolchains include:

- **Gradle, Maven, JVM** (Kotlin, Java, Groovy, Scala, et al)
- **Bazel** (supports gRPC build cache APIs)
- **C, C++, Swift, Rust, etc** (C-like toolchains, via tools like `sccache`)
- **JavaScript, TypeScript, CSS, etc** (with tools like `turborepo`)

[0]: https://github.com/features/actions
[1]: https://less.build
