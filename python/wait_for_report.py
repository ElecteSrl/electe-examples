#!/usr/bin/env python3
"""Poll GET /v1/reports/{id}/status until generation ends, then print the report.

    python wait_for_report.py <reportId> [--every 5] [--timeout 600]

Stages, from the API description: queued, analysing, writing, exporting, completed, failed.
The status object is printed on every poll so the field names are whatever the live API
returns; the loop stops when any top-level string value is "completed" or "failed".
"""
import argparse
import json
import sys
import time

from _common import run

parser = argparse.ArgumentParser()
parser.add_argument("report_id")
parser.add_argument("--every", type=float, default=5.0, help="seconds between polls")
parser.add_argument("--timeout", type=float, default=600.0, help="give up after this many seconds")
args = parser.parse_args()

TERMINAL = {"completed", "failed"}


def main(api):
    deadline = time.monotonic() + args.timeout
    while True:
        status = api.report_status(args.report_id)
        print(json.dumps(status, ensure_ascii=False), file=sys.stderr)
        stage = next((v for v in status.values() if isinstance(v, str) and v in TERMINAL), None)
        if stage == "completed":
            return api.report(args.report_id)
        if stage == "failed":
            sys.exit("→ generation failed")
        if time.monotonic() > deadline:
            sys.exit("→ timed out")
        time.sleep(args.every)


run(main)
