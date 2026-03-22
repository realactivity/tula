# Contributing to Tula

Thank you for your interest in contributing. This project is in early development and every contribution has meaningful impact, whether it is a bug report, a documentation improvement, or a new health skill.

## How to Contribute

### Report Issues

The simplest and most valuable contribution at this stage. If something does not work as expected, is unclear, or could be improved:

1. Open an issue on GitHub.
2. Describe the expected behavior and the observed behavior.
3. Include your OpenClaw version (`openclaw --version`) and Ubuntu version (`lsb_release -a`).
4. Paste any relevant error messages or log output.

### Suggest Health Skills

If you have an idea for a health-related skill, open a Discussion thread with the following information:

- The health data it would track or integrate.
- The devices or clinical systems it would connect to.
- How users would interact with it through Telegram.
- Whether you would be willing to contribute to its development.

### Build a Skill

Tula skills follow the standard OpenClaw skill format: a directory containing a `SKILL.md` file with metadata and instructions, along with any supporting scripts.

#### Skill Structure

```
skills/
  your-skill-name/
    SKILL.md          # Required: metadata, description, and agent instructions
    README.md         # Required: human-readable documentation
    scripts/          # Optional: supporting Python or JavaScript scripts
    schema.sql        # Optional: SQLite schema if the skill stores structured data
```

#### SKILL.md Format

```markdown
---
name: your-skill-name
description: "Brief description of what this skill does"
version: 1.0.0
author: Your Name
---

# Skill Name

## Overview
What this skill does and its relevance to health data management or patient support.

## Setup
Any API keys, accounts, or configuration required.

## Usage
How the user interacts with this skill through Telegram.

## Data Storage
What data is stored, the storage format, and the SQLite table schema if applicable.
```

#### Guidelines for Health Skills

- **Privacy first.** All health data must remain on the local server. No external API calls that transmit protected health information (PHI) unless the user has explicitly configured such a connection.
- **Use SQLite for structured data.** For consistency across Tula skills, structured health data should be stored in SQLite. Include the schema definition in the skill directory.
- **Support conversational interaction.** Skills should function through natural Telegram conversation, not slash commands, to maintain accessibility for non-technical users.
- **Include units and reference ranges.** Health data requires clinical context. Always store measurement units and applicable reference ranges alongside values.
- **Document the data schema.** Other skills may need to cross-reference data from your skill. Clear schema documentation supports interoperability across the Tula ecosystem.
- **Use appropriate clinical terminology.** When referencing medical concepts, use standard clinical terminology (e.g., "heart rate variability" rather than informal abbreviations). Include plain-language explanations where appropriate.

### Improve Documentation

The deployment guide and README were written during a real deployment session. If you follow the guide and encounter something that is confusing, outdated, or incorrect:

1. Fork the repository.
2. Edit the relevant file in `docs/`.
3. Submit a pull request with a brief description of the change and the rationale.

### Code Style

- Python: Follow PEP 8.
- JavaScript: Use ES6+ conventions.
- Shell scripts: Use bash with appropriate error handling.
- Commit messages: Use present tense and be concise (e.g., "Add Garmin sync skill" rather than "Added Garmin sync skill").

## Pull Request Process

1. Fork the repository.
2. Create a descriptive branch (e.g., `git checkout -b add-cgm-integration`).
3. Make your changes.
4. Test your skill with a running OpenClaw instance.
5. Submit a pull request with a clear description.

For new skills, include:
- A working SKILL.md file.
- A README.md with setup instructions.
- Any supporting scripts.
- Example Telegram interactions demonstrating the skill.

## Code of Conduct

Be respectful and constructive. Many contributors may be new to Linux, open source, or health informatics. This project exists to help individuals manage their health data and support the people they care about. Contributions should reflect that mission.

## Questions

Open a Discussion thread or reach out. No question is too basic. We are building this together.
