# Changelog

Add a `## <version>` section before releasing that version. The release workflow checks for it,
and `zapier-platform promote` shows it to Zapier users as the version's release notes. Start a
line with "Update" or "Fix" and name the trigger (for example `trigger/new_payment`) to mark it
in Zapier's changelog.

Versions up to 2.2.9 were built in Zapier's visual builder and have no entries here.

## 2.2.11

- Fix the connection test: connecting with a wrong or revoked API key now fails with an error, instead of connecting and failing later when a Zap runs.
