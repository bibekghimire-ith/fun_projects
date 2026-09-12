# Host Integration Security

Do not mount the entire host filesystem. Use explicit workspace mounts and allowed roots.

Do not mount the Docker socket by default; it can provide host-level privileges. Prefer a
restricted Docker API proxy or dedicated worker.

For SSH, prefer agent forwarding or a secret provider rather than copying private keys into the
container.

For VS Code, prefer a VS Code extension/client talking to the assistant API instead of arbitrary
desktop process control.
