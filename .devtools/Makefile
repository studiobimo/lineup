APP_DIR := apps/web

# Everything the app ships, lazy chunks and CSS included, so a stray dependency cannot slip by. The
# PRD's limit is a different number: 200 kB of JavaScript before any lazy route, 198.8 kB today:
# the planner's strings and the album editor load with their routes.
# Motion's features are 19 KiB of this and load after first paint. AppProviders put Motion's core
# and toasts in the entry chunk, which split one more chunk off. M1 ended at 319.5 KiB. M2's colour
# code has to ship in the image worker as well as the app, and sorting, backups and offline support
# follow it. Keep raising this rather than cut features: heavy trimming starts at half of
# Cloudflare's bundle limit. Raising it still needs a reason. The city list and the metadata reader
# are 82 KiB of this, and load only for someone who turns on capture dates or locations. M4's forms
# and the provider's screens load with Settings or a schedule, never before.
BUNDLE_TOTAL_KIB := 600

# The PRD's limit on what loads before any lazy route.
FIRST_LOAD_KB := 200

# M4's provider routes took it from 18.5 to 61.8 KiB, nearly all of it zod, which the contract shares
# with the app (ADR-0005). That is 2% of Cloudflare's limit. Raising it needs a reason.
WORKER_GZIP_KIB := 110

include base.mk
include vite.mk

# Nothing imports these yet, so tsc would not reach them through the app.
TSC_PROJECTS += ../../packages/api ../../packages/contract

# ADR-0019: each environment ships from one branch, so a laptop cannot put a feature on production.
DEPLOY_ENVS := development production
DEPLOY_BRANCH_development := develop
DEPLOY_BRANCH_production := main

.PHONY: e2e memory-budget first-load worker-budget knip duplication bundle-report openapi api-breaking deploy-branch

deploy: deploy-branch

deploy-branch:
	$(require-deploy-env)
	@# Workers Builds checks out a detached HEAD, so git has no branch; it names it in WORKERS_CI_BRANCH.
	@branch=$$(git branch --show-current); branch=$${branch:-$$WORKERS_CI_BRANCH}; [ "$$branch" = "$(DEPLOY_BRANCH_$(ENV))" ] || { \
		echo "$(GLYPH_FAIL) $(ENV) ships from $(DEPLOY_BRANCH_$(ENV)), and this is $$branch" >&2; exit 1; }

e2e: build playwright-install ## Playwright, against the built app
	$(APP_PNPM) exec playwright test --project=chromium

memory-budget: build playwright-install ## Fail if a 300-image board passes the PRD's memory limit
	$(APP_PNPM) exec playwright test --project=budget

first-load: build ## Fail if the script a first visit downloads passes the PRD's limit
	$(APP_CD) && $(MISE) exec -- node $(ROOT)/.devtools/scripts/first-load.mjs \
		--dir dist/client --limit-kb $(FIRST_LOAD_KB)

worker-budget: build ## Fail if the Worker outgrows its gzip budget
	$(APP_CD) && $(MISE) exec -- node $(ROOT)/.devtools/scripts/worker-budget.mjs \
		--gzip-kib $(WORKER_GZIP_KIB)

knip: ## Fail on unused files, dependencies and exports
	$(PNPM) exec knip

duplication: ## Fail if copied code passes the threshold in .jscpd.json
	$(PNPM) exec jscpd

openapi: ## Regenerate the API reference from the routes
	$(PNPM) --filter lineup-api exec vitest run src/openapi.test.ts --update

API_DOCUMENT := apps/web/public/api-docs/openapi.json
BASE ?= origin/main

api-breaking: ## Fail if the API reference breaks v1, against BASE (a new document has nothing to break)
	@cd $(ROOT) && if git cat-file -e $(BASE):$(API_DOCUMENT) 2>/dev/null; then \
		git show $(BASE):$(API_DOCUMENT) > $(API_DOCUMENT).base && \
		$(MISE) exec -- node .devtools/scripts/api-breaking.mjs $(API_DOCUMENT).base $(API_DOCUMENT); \
		status=$$?; rm -f $(API_DOCUMENT).base; exit $$status; \
	else echo "✔ api reference: no document at $(BASE) to compare"; fi

bundle-report: ## Build, and write a picture of the bundle to dist/bundle-report.html
	$(APP_CD) && ANALYZE=1 $(MISE) exec -- pnpm exec vite build

ci: e2e memory-budget first-load worker-budget knip duplication
