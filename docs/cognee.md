# Cognee Setup Notes

Cognee is optional for v0.1. The audit tool does not require it to run.

## Suggested use

Use Cognee as a knowledge layer for:

- Audit methodology notes.
- Dimaso service playbooks.
- Historical audit examples.
- Platform-specific public fingerprint references.

Keep API keys and private client data outside the frontend and outside Git.

## Optional MCP config example

```json
{
  "mcpServers": {
    "cognee": {
      "command": "uvx",
      "args": ["cognee-mcp"],
      "env": {
        "COGNEE_API_KEY": "replace-with-local-secret"
      }
    }
  }
}
```

Copy this into your local MCP configuration only if Cognee is installed and configured. Do not commit real keys.
