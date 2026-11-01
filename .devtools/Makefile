APP_DIR := apps/web

# Everything the app ships, lazy chunks and CSS included, so a stray dependency cannot slip by. The
# PRD's limit is a different number: 200 kB of JavaScript before any lazy route, 166 KiB today.
# Motion is 48 KiB of this and loads after first paint. Raising it needs a reason.
BUNDLE_TOTAL_KIB := 290

# Set from the M0 scaffold, 16.9 KiB, with room for the API (ADR-0005). Raising it needs a reason.
WORKER_GZIP_KIB := 32

include base.mk
include vite.mk

# Nothing imports these yet, so tsc would not reach them through the app.
TSC_PROJECTS += ../../packages/api ../../packages/contract

.PHONY: e2e worker-budget

# GitHub's runners set CI, and have the browser's system libraries to install.
e2e: build ## Playwright, against the built app
	$(APP_PNPM) exec playwright install $(if $(CI),--with-deps) chromium
	$(APP_PNPM) exec playwright test

worker-budget: build ## Fail if the Worker outgrows its gzip budget
	$(APP_CD) && $(MISE) exec -- node $(ROOT)/.devtools/scripts/worker-budget.mjs \
		--gzip-kib $(WORKER_GZIP_KIB)

ci: e2e worker-budget
