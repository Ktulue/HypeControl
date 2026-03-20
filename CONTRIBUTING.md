# Contributing to Hype Control

Thanks for your interest in contributing! Here's how to get started.

## Before You Start

**Please file an issue first.** Whether it's a bug report or a feature idea, open an issue so we can discuss the approach before you write code. This avoids wasted effort on both sides.

- [Report a bug](https://github.com/Ktulue/HypeControl/issues/new?template=bug_report.md)
- [Suggest a feature](https://github.com/Ktulue/HypeControl/discussions/new?category=ideas)

## Development Setup

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/Ktulue/HypeControl.git
cd HypeControl
npm install          # installs deps and builds via postinstall
```

Load the extension in Chrome:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

## Making Changes

1. Fork the repo and create a branch: `feat/your-feature`, `fix/your-bug`, or `maint/your-cleanup`
2. Make your changes
3. Run `npm run build` to verify the build passes
4. Open a PR against `main`

## License

By contributing, you agree that your contributions will be licensed under the [GNU GPL v3.0](LICENSE).
