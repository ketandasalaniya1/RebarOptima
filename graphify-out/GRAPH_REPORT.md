# Graph Report - .  (2026-08-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1226 nodes · 1795 edges · 116 communities (72 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f4cdf19f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- gray
- app.module.ts
- search
- color
- button
- slide_search_core.py
- spacing
- html-token-validator.py
- TestTailwindConfigGenerator
- BM25
- InventoryService
- compilerOptions
- generate-slide.py
- TailwindConfigGenerator
- design_system.py
- inventory.module.ts
- main
- DesignSystemGenerator
- dependencies
- fetch-background.py
- User
- icon/generate.py
- fontSize
- TestShadcnInstaller
- CurrentUser
- batches.module.ts
- extract-colors.cjs
- validate-asset.cjs
- .add_components
- ShadcnInstaller
- scripts
- validate-tokens.cjs
- test_tailwind_config_gen.py
- inject-brand-context.cjs
- embed-tokens.cjs
- primitive
- patch
- search
- dependencies
- devDependencies
- logo/generate.py
- generate-tokens.cjs
- ._base_config
- frontend/package.json
- sync-brand-to-tokens.cjs
- _run
- BM25
- jest
- radius
- ._generate_javascript
- format_ascii_box
- main.ts
- exclude
- package.json
- backend/package.json
- devDependencies
- dependencies
- scripts
- shadow
- nest-cli.json
- lg
- default
- md
- none
- is_server_ready
- moduleFileExtensions
- test_sync_brand_to_tokens.py
- main
- test_shadcn_add.py
- .test_add_all_components_dry_run
- .temp_project
- .test_add_components_already_installed
- .test_add_all_components_no_config
- .test_recommend_plugins
- .test_recommend_plugins_nextjs
- .test_generate_config_with_colors
- .test_validate_config_valid
- .test_validate_config_empty_theme
- .test_init_javascript
- .test_write_config_invalid_path
- .test_default_output_path_typescript
- .test_default_content_paths_nextjs
- .test_add_colors
- .test_check_shadcn_config_exists
- rxjs
- bcryptjs
- @eslint/eslintrc
- @eslint/js
- eslint-plugin-prettier
- globals
- jest
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- prettier
- source-map-support
- supertest
- ts-jest
- ts-loader
- ts-node
- @types/bcryptjs
- @types/express
- @types/jest
- @types/node
- @types/pdfkit
- @types/supertest
- typescript
- typescript-eslint
- tsconfig-paths

## God Nodes (most connected - your core abstractions)
1. `TailwindConfigGenerator` - 58 edges
2. `TestTailwindConfigGenerator` - 35 edges
3. `ShadcnInstaller` - 34 edges
4. `TestShadcnInstaller` - 26 edges
5. `compilerOptions` - 22 edges
6. `User` - 21 edges
7. `react` - 17 edges
8. `color` - 15 edges
9. `InventoryService` - 15 edges
10. `scripts` - 13 edges

## Surprising Connections (you probably didn't know these)
- `TestShadcnInstaller` --uses--> `ShadcnInstaller`  [INFERRED]
  .agents/skills/ui-styling/scripts/tests/test_shadcn_add.py → .agents/skills/ui-styling/scripts/shadcn_add.py
- `TestGeneratedConfigIsValidJs` --uses--> `TailwindConfigGenerator`  [INFERRED]
  .agents/skills/ui-styling/scripts/tests/test_tailwind_config_gen.py → .agents/skills/ui-styling/scripts/tailwind_config_gen.py
- `TestTailwindConfigGenerator` --uses--> `TailwindConfigGenerator`  [INFERRED]
  .agents/skills/ui-styling/scripts/tests/test_tailwind_config_gen.py → .agents/skills/ui-styling/scripts/tailwind_config_gen.py
- `_generate_intelligent_overrides()` --calls--> `search()`  [EXTRACTED]
  .agents/skills/ui-ux-pro-max/scripts/design_system.py → .agents/skills/ui-ux-pro-max/scripts/core.py
- `main()` --calls--> `search()`  [EXTRACTED]
  .agents/skills/design-system/scripts/search-slides.py → .agents/skills/design-system/scripts/slide_search_core.py

## Import Cycles
- None detected.

## Communities (116 total, 44 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.06
Nodes (37): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, App(), ScrollToTop(), SideNavbar() (+29 more)

### Community 1 - "gray"
Cohesion: 0.05
Nodes (53): $type, $value, $type, $value, $type, $value, $type, $value (+45 more)

### Community 2 - "app.module.ts"
Cohesion: 0.07
Nodes (27): AppController, Controller, Get, AppModule, Module, AppService, Injectable, AuthController (+19 more)

### Community 3 - "search"
Cohesion: 0.07
Nodes (42): BM25, detect_domain(), get_cip_brief(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection (+34 more)

### Community 4 - "color"
Cohesion: 0.04
Nodes (48): $type, $value, background, destructive, destructive-foreground, foreground, muted, muted-foreground (+40 more)

### Community 5 - "button"
Cohesion: 0.06
Nodes (45): $type, $value, $type, $value, bg, fg, font-size, hover-bg (+37 more)

### Community 6 - "slide_search_core.py"
Cohesion: 0.09
Nodes (36): format_context(), format_result(), main(), Format a single search result for display, Format contextual recommendations for display., BM25, calculate_pattern_break(), detect_domain() (+28 more)

### Community 7 - "spacing"
Cohesion: 0.06
Nodes (34): $type, $value, $type, $value, $type, $value, $type, $value (+26 more)

### Community 8 - "html-token-validator.py"
Cohesion: 0.14
Nodes (24): get_context(), is_allowed_exception(), is_allowed_rgba(), is_inside_block(), load_css_variables(), main(), print_result(), print_summary() (+16 more)

### Community 9 - "TestTailwindConfigGenerator"
Cohesion: 0.08
Nodes (13): Test adding full color palette., Test adding custom fonts., Test adding custom breakpoints., Test TailwindConfigGenerator class., Test generating JavaScript configuration., Test generating config with plugins., Test generating complete TypeScript configuration., Test initialization with different frameworks. (+5 more)

### Community 10 - "BM25"
Cohesion: 0.12
Nodes (19): BM25, detect_domain(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection, Search across all domains and combine results (+11 more)

### Community 11 - "InventoryService"
Cohesion: 0.13
Nodes (10): InventoryController, Body, Controller, Get, Post, UseGuards, InventoryService, Injectable (+2 more)

### Community 12 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 13 - "generate-slide.py"
Cohesion: 0.15
Nodes (19): _e(), generate_chart_slide(), generate_cta_slide(), generate_deck(), generate_metrics_slide(), generate_problem_slide(), generate_solution_slide(), generate_testimonial_slide() (+11 more)

### Community 14 - "TailwindConfigGenerator"
Cohesion: 0.10
Nodes (11): Generate Tailwind CSS configuration files., Add full color palette (50-950 shades) for a base color. Args: name: Color name…, TailwindConfigGenerator, Test adding colors multiple times., Test adding custom spacing., Test that adding same plugin twice doesn't duplicate., Test generating TypeScript configuration., Test initialization with default settings. (+3 more)

### Community 15 - "design_system.py"
Cohesion: 0.15
Nodes (18): _detect_page_type(), format_markdown(), format_master_md(), format_page_override_md(), generate_design_system(), _generate_intelligent_overrides(), persist_design_system(), Format a page-specific override file with intelligent AI-generated content. (+10 more)

### Community 16 - "inventory.module.ts"
Cohesion: 0.19
Nodes (13): InjectModel, InventoryTransaction, InventoryTransactionSchema, Prop, Schema, ScrapRule, ScrapRuleSchema, Prop (+5 more)

### Community 17 - "main"
Cohesion: 0.11
Nodes (10): main(), Add custom font families. Args: fonts: Dict of font_type: [font_names] e.g.,…, Add custom spacing values. Args: spacing: Dict of name: value e.g., {'18':…, Add custom breakpoints. Args: breakpoints: Dict of name: width e.g., {'3xl':…, Add plugin requirements. Args: plugins: List of plugin names e.g.,…, Get plugin recommendations based on configuration. Returns: List of recommended…, Generate configuration file content. Returns: Configuration file as string, Write configuration to file. Returns: Tuple of (success, message) (+2 more)

### Community 18 - "DesignSystemGenerator"
Cohesion: 0.14
Nodes (11): DesignSystemGenerator, Find matching reasoning rule for a category., Apply reasoning rules to search results., Select best matching result based on priority keywords., Extract results list from search result dict., Generate complete design system recommendation. variance/motion/density are…, Bucket a 1-10 dial value into its tier config. Returns None if value is None., Generates design system recommendations from aggregated searches. (+3 more)

### Community 19 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, dotenv, jsonwebtoken, mongoose, @nestjs/common, @nestjs/core, @nestjs/mongoose, @nestjs/platform-express (+11 more)

### Community 20 - "fetch-background.py"
Cohesion: 0.17
Nodes (17): generate_css_for_background(), get_background_image(), get_curated_images(), get_overlay_css(), get_pexels_search_url(), load_backgrounds_config(), load_brand_colors(), main() (+9 more)

### Community 21 - "User"
Cohesion: 0.20
Nodes (9): JwtAuthGuard, Injectable, Prop, Schema, User, UserSchema, Injectable, InjectModel (+1 more)

### Community 22 - "icon/generate.py"
Cohesion: 0.20
Nodes (15): apply_color(), apply_viewbox_size(), extract_svgs(), generate_batch(), generate_icon(), generate_sizes(), load_env(), main() (+7 more)

### Community 23 - "fontSize"
Cohesion: 0.12
Nodes (16): $type, $value, $type, $value, $type, $value, $type, $value (+8 more)

### Community 24 - "TestShadcnInstaller"
Cohesion: 0.16
Nodes (7): Test ShadcnInstaller class., Test listing installed components when none exist., Test initialization with custom project root., Test getting installed components when none exist., Test getting installed components without config., Test adding components with empty list., TestShadcnInstaller

### Community 25 - "CurrentUser"
Cohesion: 0.18
Nodes (7): CurrentUser, BatchesController, Body, Controller, Get, Post, UseGuards

### Community 26 - "batches.module.ts"
Cohesion: 0.17
Nodes (11): Batch, BatchSchema, Prop, Schema, BatchesService, Injectable, InjectModel, InventoryModule (+3 more)

### Community 27 - "extract-colors.cjs"
Cohesion: 0.22
Nodes (11): calculateCompliance(), colorDistance(), displayPalette(), extractHexColors(), findNearestBrandColor(), fs, generateImageMagickCommand(), hexToRgb() (+3 more)

### Community 28 - "validate-asset.cjs"
Cohesion: 0.25
Nodes (13): checkManifest(), formatBytes(), formatOutput(), fs, main(), parseFilename(), path, RULES (+5 more)

### Community 29 - ".add_components"
Cohesion: 0.20
Nodes (7): main(), Add all available shadcn/ui components. Args: overwrite: If True, overwrite…, List installed components. Returns: Tuple of (success, message with component…, Check if shadcn is initialized in project. Returns: True if components.json…, Get list of already installed components. Returns: List of installed component…, Read shadcn version from project package.json; fall back to a pinned default., Add shadcn/ui components. Args: components: List of component names to add…

### Community 30 - "ShadcnInstaller"
Cohesion: 0.15
Nodes (8): Path, Handle shadcn/ui component installation., Initialize installer. Args: project_root: Project root directory (default:…, ShadcnInstaller, Test adding components without shadcn config., Test initialization with default project root., Test initialization with dry run mode., Test checking for non-existent shadcn config.

### Community 31 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, format, lint, start, start:debug, start:dev, start:prod (+5 more)

### Community 32 - "validate-tokens.cjs"
Cohesion: 0.24
Nodes (11): extensions, formatReport(), fs, getFiles(), main(), parseArgs(), path, patterns (+3 more)

### Community 33 - "test_tailwind_config_gen.py"
Cohesion: 0.20
Nodes (8): Tests for tailwind_config_gen.py, Reduce a generated TS/JS config to a bare assignable object so it can be handed…, Regression guard for the missing-comma bug between the ``theme`` block and…, The property preceding ``plugins`` must end with a comma (pure-Python check, so…, The emitted config parses as valid JS via ``node --check``., _strip_to_object(), TestGeneratedConfigIsValidJs, parametrize

### Community 34 - "inject-brand-context.cjs"
Cohesion: 0.31
Nodes (10): extractColorsFromTable(), extractCoreAttributes(), extractHexColors(), extractImageStyle(), extractTypography(), extractVoice(), fs, generatePromptAddition() (+2 more)

### Community 35 - "embed-tokens.cjs"
Cohesion: 0.20
Nodes (9): args, extractTokens(), fs, minimal, MINIMAL_TOKENS, path, projectRoot, tokensPath (+1 more)

### Community 36 - "primitive"
Cohesion: 0.18
Nodes (11): fast, normal, slow, $type, $value, $type, $value, primitive (+3 more)

### Community 37 - "patch"
Cohesion: 0.18
Nodes (6): Test adding components with overwrite flag., Test successful component addition., Test component addition with subprocess error., Test component addition when npx is not found., Test successful addition of all components., patch

### Community 38 - "search"
Cohesion: 0.25
Nodes (10): detect_domain(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection, Search stack-specific guidelines, search() (+2 more)

### Community 39 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, html2pdf.js, react, react-dom, react-redux, @reduxjs/toolkit, html2pdf.js, react (+3 more)

### Community 40 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, oxlint, @types/react (+3 more)

### Community 41 - "logo/generate.py"
Cohesion: 0.29
Nodes (9): enhance_prompt(), generate_batch(), generate_logo(), load_env(), main(), Enhance the logo prompt with style and industry modifiers, Generate a logo using Gemini models with image generation Args: aspect_ratio:…, Generate multiple logo variants with different styles (+1 more)

### Community 42 - "generate-tokens.cjs"
Cohesion: 0.36
Nodes (9): flattenTokens(), fs, generateCSS(), generateTailwind(), main(), parseArgs(), path, resolveReference() (+1 more)

### Community 43 - "._base_config"
Cohesion: 0.22
Nodes (6): Path, Initialize generator. Args: typescript: If True, generate .ts config, else .js…, Determine default output path., Create base configuration structure., Get default content paths for framework., Any

### Community 44 - "frontend/package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 45 - "sync-brand-to-tokens.cjs"
Cohesion: 0.33
Nodes (8): adjustBrightness(), { execFileSync }, extractColorsFromMarkdown(), fs, generateColorScale(), main(), path, updateDesignTokens()

### Community 46 - "_run"
Cohesion: 0.28
Nodes (8): Path, Regression tests for validate-tokens.cjs. The validator used to skip any line…, A hardcoded hex on the same line as a var() token is still a violation., A line that references only tokens produces no false positives., _run(), test_flags_hardcoded_hex_sharing_line_with_token(), test_token_only_line_reports_no_violation(), CompletedProcess

### Community 47 - "BM25"
Cohesion: 0.28
Nodes (5): BM25, BM25 ranking algorithm for text search, Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query

### Community 48 - "jest"
Cohesion: 0.22
Nodes (9): jest, collectCoverageFrom, coverageDirectory, rootDir, testEnvironment, testRegex, transform, ^.+\\.(t|j)s$ (+1 more)

### Community 49 - "radius"
Cohesion: 0.29
Nodes (8): xl, $type, $value, radius, full, xl, $type, $value

### Community 50 - "._generate_javascript"
Cohesion: 0.29
Nodes (4): Generate TypeScript configuration., Generate JavaScript configuration., Format plugins array for config. Validates each plugin name against a strict…, Add indentation to JSON string.

### Community 51 - "format_ascii_box"
Cohesion: 0.25
Nodes (8): ansi_ljust(), format_ascii_box(), hex_to_ansi(), Convert hex color to ANSI True Color swatch (██) with fallback., Like str.ljust but accounts for zero-width ANSI escape sequences., Create a Unicode section separator: ├─── NAME ───...┤, Format design system as Unicode box with ANSI color swatches., section_header()

### Community 53 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 54 - "package.json"
Cohesion: 0.25
Nodes (7): allowScripts, lucide-react@1.25.0, name, private, workspaces, backend, frontend

### Community 55 - "backend/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 56 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, eslint, eslint-config-prettier, @types/jsonwebtoken, eslint, eslint-config-prettier, @types/jsonwebtoken

### Community 57 - "dependencies"
Cohesion: 0.29
Nodes (7): lucide-react, @vercel/analytics, dependencies, lucide-react, @vercel/analytics, lucide-react, @vercel/analytics

### Community 58 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:backend, lint, start:backend, test:backend

### Community 59 - "shadow"
Cohesion: 0.47
Nodes (6): sm, shadow, sm, sm, $type, $value

### Community 60 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 61 - "lg"
Cohesion: 0.60
Nodes (5): lg, $type, $value, lg, lg

### Community 62 - "default"
Cohesion: 0.67
Nodes (4): $type, $value, default, default

### Community 63 - "md"
Cohesion: 0.67
Nodes (4): $type, $value, md, md

### Community 64 - "none"
Cohesion: 0.67
Nodes (4): $type, $value, none, none

### Community 65 - "is_server_ready"
Cohesion: 0.67
Nodes (3): is_server_ready(), main(), Wait for server to be ready by polling the port.

### Community 66 - "moduleFileExtensions"
Cohesion: 0.50
Nodes (4): moduleFileExtensions, js, json, ts

## Knowledge Gaps
- **255 isolated node(s):** `fs`, `path`, `fs`, `path`, `fs` (+250 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `primitive` connect `primitive` to `gray`, `color`, `spacing`, `radius`, `fontSize`, `shadow`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `component` connect `button` to `color`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `color` connect `gray` to `primitive`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TailwindConfigGenerator` (e.g. with `TestGeneratedConfigIsValidJs` and `TestTailwindConfigGenerator`) actually correct?**
  _`TailwindConfigGenerator` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `fs`, `path`, `fs` to the rest of the system?**
  _255 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06299603174603174 - nodes in this community are weakly interconnected._
- **Should `gray` be split into smaller, more focused modules?**
  _Cohesion score 0.05370101596516691 - nodes in this community are weakly interconnected._