# Security policy

## Scope

HUQAN Trust Panel is a desktop-only, read-only Obsidian plugin. It sends verification requests only to a configured loopback HUQAN server and never calls mutation, ingest, approval, or action endpoints.

The API key is stored in Obsidian's local plugin data. It is not an encrypted credential store. Use a dedicated local key and rotate it if the Obsidian vault or local machine may have been exposed.

## Reporting a vulnerability

Please report security issues privately through the security contact or security reporting mechanism configured on the HUQAN repository:

https://github.com/ali-ulu/huqan/security

Do not include API keys, vault contents, personal data, or other secrets in a public issue.
