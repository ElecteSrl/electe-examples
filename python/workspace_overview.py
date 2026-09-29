#!/usr/bin/env python3
"""One workspace and everything the v1 API says about it: data sources, reports, usage, webhooks.

    python workspace_overview.py <workspaceId>

Expected: a JSON object with one key per route. Credentials and webhook secrets are never
in these answers by design.
"""
import sys

from _common import run

if len(sys.argv) != 2:
    sys.exit("usage: workspace_overview.py <workspaceId>")
WORKSPACE_ID = sys.argv[1]


def main(api):
    return {
        "workspace": api.workspace(WORKSPACE_ID),
        "data_sources": api.data_sources(WORKSPACE_ID),
        "reports": api.reports(WORKSPACE_ID),
        "usage": api.usage(WORKSPACE_ID),
        "webhooks": api.webhooks(WORKSPACE_ID),
    }


run(main)
