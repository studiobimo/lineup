APP_DIR := apps/web

# The PRD's first load is 200 kB of gzipped JavaScript, which is 195 KiB here. The check counts
# the CSS and the lazy chunks too, so it trips early rather than late.
BUNDLE_TOTAL_KIB := 195

include base.mk
include vite.mk

# Nothing imports these yet, so tsc would not reach them through the app.
TSC_PROJECTS += ../../packages/api ../../packages/contract
