# Permissions

Use deny-by-default for privileged capabilities.

Example scopes:
fs.read, fs.write, shell.execute, browser.navigate, browser.submit, docker.read, docker.write,
ssh.connect, db.read, db.write, github.read, github.write, gmail.read, gmail.send,
calendar.read, calendar.write, discord.send, telegram.send, notion.write.

Approval modes:
automatic, ask-once, ask-every-time, admin-only, disabled.

Use resource restrictions such as filesystem roots, SSH host allowlists, repository allowlists
and database connection allowlists.
