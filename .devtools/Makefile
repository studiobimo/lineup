APP_DIR := apps/web

# Everything the app ships, lazy chunks and CSS included, so a stray dependency cannot slip by. The
# PRD's limit is a different number: 200 kB of JavaScript before any lazy route, 198.8 kB today:
# the planner's strings and the album editor load with their routes.
# Motion's features are 19 KiB of this and load after first paint. AppProviders put Motion's core
# and toasts in the entry chunk, which split one more chunk off. M1 ended at 319.5 KiB. M2's colour
# code has to ship in the image worker as well as the app, and sorting, backups and offline support
# follow it. Keep raising this rather than cut features: heavy trimming starts at half of
# Cloudflare's bundle limit. Raising it still needs a reason. The city list and the metadata reader
# are 82 KiB of this, and load only for someone who turns on capture dates or locations.
BUNDLE_TOTAL_KIB := 480

# M4's provider routes took it from 18.5 to 61.8 KiB, nearly all of it zod, which the contract shares
# with the app (ADR-0005). That is 2% of Cloudflare's limit. Raising it needs a reason.
WORKER_GZIP_KIB := 80

include base.mk
include vite.mk

# Nothing imports these yet, so tsc would not reach them through the app.
TSC_PROJECTS += ../../packages/api ../../packages/contract

.PHONY: e2e worker-budget knip duplication bundle-report

# GitHub's runners set CI, and have the browser's system libraries to install.
e2e: build ## Playwright, against the built app
	$(APP_PNPM) exec playwright install $(if $(CI),--with-deps) chromium
	$(APP_PNPM) exec playwright test

worker-budget: build ## Fail if the Worker outgrows its gzip budget
	$(APP_CD) && $(MISE) exec -- node $(ROOT)/.devtools/scripts/worker-budget.mjs \
		--gzip-kib $(WORKER_GZIP_KIB)

knip: ## Fail on unused files, dependencies and exports
	$(PNPM) exec knip

duplication: ## Fail if copied code passes the threshold in .jscpd.json
	$(PNPM) exec jscpd

bundle-report: ## Build, and write a picture of the bundle to dist/bundle-report.html
	$(APP_CD) && ANALYZE=1 $(MISE) exec -- pnpm exec vite build

ci: e2e worker-budget knip duplication
