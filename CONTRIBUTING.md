# Contributing

Thank you for your interest in contributing! This guide explains how to propose changes in a way that keeps the project stable and easy to review. Contributors of all experience levels are welcome.

## Getting started

1. Read the `README` for setup and run instructions.
2. Look through open **Issues** for something to work on, or open a new one to propose an idea.
3. Comment on the issue before starting, so work isn't duplicated.

For larger changes, please discuss the approach in an issue first.

## Workflow

1. **Fork** the repository (or clone it, if you have write access).
2. **Update** your local `main` branch before starting.
3. **Create a branch** for your work. Never commit directly to `main`.

   ```bash
   git checkout -b feature/short-description
   ```

4. **Make your changes** in small, focused commits.
5. **Check your work:** run the project's build and tests locally and make sure they pass.
6. **Push** your branch and open a **pull request**.

## Branch names

Use `type/short-description`, in lowercase with dashes:

| Prefix | Purpose |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation |
| `refactor/` | Code improvements with no change in behaviour |

## Commit messages

Write short, clear messages in the present tense:

```
feat: add user profile page
fix: correct date shown on summary screen
docs: clarify setup steps
```

Common types are `feat`, `fix`, `docs`, `refactor`, `test` and `chore`.

## Pull requests

- Keep each pull request focused on **one change**.
- Use a clear title and describe **what** changed and **why**.
- Link related issues (for example, `Closes #12`).
- Add screenshots for visual changes.
- Make sure all automated checks pass.
- Respond to review feedback by pushing new commits to the same branch.

## Code guidelines

- Follow the existing style and structure of the code you are working in.
- Use clear, descriptive names.
- Keep changes minimal. Avoid unrelated edits or reformatting whole files.
- Remove unused code and debugging output before committing.
- Add or update documentation when behaviour changes.

## Security

- Never commit passwords, API keys, tokens or environment files.
- Report security vulnerabilities **privately** to the maintainers, not in a public issue.

## Code of conduct

Be respectful, constructive and patient. Give feedback on the code, not the person. Harassment or disrespectful behaviour is not tolerated.

---

Thank you for helping improve this project!
