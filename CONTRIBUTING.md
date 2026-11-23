# Contributing to FrameDock

Report bugs or discuss a feature in GitHub Issues. For a preview bug, include the browser and version, device preset, orientation, expected behaviour, and steps to reproduce. Use a shareable test page and redact private URLs and account details from screenshots.

## Build and preview

From your checkout:

```sh
docker compose -f compose.dev.yml up --build -d
```

Open [FrameDock](http://localhost:9637). Add a test site and check the behaviour you changed. For preview or toolbar changes, verify the affected phone and desktop views. Include results from Safari and a Chromium browser if the change affects shared rendering.

The frontend lives in `src/` and uses React, TypeScript, Tailwind CSS, and Vite. Bun runs the application and relay in `server.ts` and `relay.ts`. For a frontend-only build check, run `bun install --frozen-lockfile` and `bun run build` using the Bun version pinned in the Dockerfile.

## Coding style

- Use descriptive names and familiar patterns. Reuse existing code where it fits.
- Keep each change focused. Preserve existing behaviour unless the change calls for it.
- Fix observable performance problems. If an optimisation makes the code harder to read, explain the reason and include a measurement or a reproducible example.

Run `bun run check:style path/to/file.ts` on the TypeScript or JavaScript files you edit. Run `bun run format path/to/file.ts` to apply the formatter. CI checks changed source files on pull requests and pushes to `main`.

## Commits

Keep commits focused. Use a short subject in the imperative, such as `Fix preview rotation`. Add a body when the reason or trade-off needs explaining.

## Open a pull request

1. Fork the repository and make your change on a branch.
2. Follow the surrounding code. Use `.tsx` for files with JSX and `.ts` for the rest. Keep formatting changes close to the lines you edit.
3. Open a pull request against `main`. Link the issue, describe what changed, and include verification steps and screenshots for visible changes.
4. If you used a coding agent, review the diff yourself and include the checks you actually ran.
5. Check the Docker build and smoke test in the pull request. If a check fails, open its log, fix the branch, and push again to rerun it.

## Release a version

Require the Docker CI check on pull requests into `main` and limit creation of `v*` tags to release maintainers when repository rulesets are available.

Maintainers release a tested commit from `main` with a new version tag such as `v0.1.0`. The release workflow builds and smoke-tests both Docker platforms, publishes the image with both its version tag and the latest tag, then creates the GitHub release with standard install instructions, a GitHub-generated changelog for updates, the install Compose file and the matching source archive. Add an **Upgrade notes** section only when users need to take action.

A failed build or smoke test stops before the image is published. Open the first failed step in GitHub Actions. Rerun the same tag for a temporary runner or registry error. For a code fix, merge the fix after CI passes and use a new version tag. If the image was published and only the GitHub release step failed, rerun after resolving that error. Keep published tags on their original commits.
