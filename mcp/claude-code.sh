#!/usr/bin/env sh
# Claude Code: register the ELECTE server once, then ask your first question.
claude mcp add --transport http electe \
  https://mcp.electe.net/sse \
  --header "Authorization: Bearer <YOUR_API_KEY>"
