# Changelog

Add a `## <version>` section before releasing that version. The release workflow checks for it,
and `zapier-platform promote` shows it to Zapier users as the version's release notes. Start a
line with "Update" or "Fix" and name the trigger (for example `trigger/new_payment`) to mark it
in Zapier's changelog.

Versions before 2.2.9 were built in Zapier's visual builder and have no entries here. Keep the
2.2.9 section: `zapier-platform promote 2.2.9`, the rollback, refuses a version with no section.

## 2.2.10

- Fix the connection test: connecting with a wrong or revoked API key now fails with an error, instead of connecting and failing later when a Zap runs.

## 2.2.9

- Last version built in Zapier's visual builder; converted to code unchanged.
