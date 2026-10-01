#!/usr/bin/env bash
# One-command runner for the realistic art pipeline on your own machine (macOS / Linux).
#
#   art/gen/run.sh setup        # once: virtualenv + dependencies (about 2 GB; models download on first generate)
#   art/gen/run.sh doctor       # check the machine
#   art/gen/run.sh pilot [N]    # guides + N candidates (default 4) for the 7 pilot slots
#   art/gen/run.sh all [N]      # every slot that has a description
#   art/gen/run.sh contact      # open the candidate sheet
#   art/gen/run.sh build        # after `python promote.py pick ...`: WebP bundle + checks + sheet
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
VENV=".venv"
py() { "$VENV/bin/python" "$@"; }

case "${1:-help}" in
  setup)
    command -v python3 >/dev/null || { echo "install Python 3.10+ first (macOS: brew install python@3.11)"; exit 1; }
    python3 -m venv "$VENV"
    py -m pip install --upgrade pip
    py -m pip install -r requirements.txt
    py generate.py doctor || true
    ;;
  doctor) py generate.py doctor ;;
  pilot)
    (cd "$ROOT" && pnpm art:gen:guides --pilot)
    py generate.py run --seeds "${2:-4}"
    py promote.py contact
    echo "Open art/gen/work/contact.html, then:  $VENV/bin/python promote.py pick building.bank=2 …"
    ;;
  all)
    (cd "$ROOT" && pnpm art:gen:guides)
    py generate.py run --seeds "${2:-4}"
    py promote.py contact
    ;;
  contact) py promote.py contact && (command -v open >/dev/null && open work/contact.html || echo "open art/gen/work/contact.html") ;;
  build)
    py promote.py build
    py promote.py check
    py promote.py sheet
    (command -v open >/dev/null && open ../bundles/realistic/contact.html) || echo "open art/bundles/realistic/contact.html"
    ;;
  *) sed -n '2,10p' "$0" ;;
esac
