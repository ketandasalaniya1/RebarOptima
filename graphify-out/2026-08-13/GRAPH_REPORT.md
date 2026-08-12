# Graph Report - RebarOptima  (2026-08-13)

## Corpus Check
- 168 files · ~218,991 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1250 nodes · 1788 edges · 130 communities (77 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `55df8ae9`
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
- persist_design_system
- inventory.module.ts
- main
- DesignSystemGenerator
- dependencies
- fetch-background.py
- User
- icon/generate.py
- fontSize
- TestShadcnInstaller
- BatchesService
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
- duration
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
- design_system.py
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
- auth.module.ts
- md
- none
- is_server_ready
- moduleFileExtensions
- test_sync_brand_to_tokens.py
- main
- test_shadcn_add.py
- companies.module.ts
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
- 🛠️ 2. Complete Terminal Command Reference
- rxjs
- bcryptjs
- _generate_intelligent_overrides
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
- primitive
- xl
- .test_init_default_project_root
- .test_add_components_no_components
- eslint-config-prettier
- Body
- Controller
- Get
- Post
- UseGuards
- Injectable
- InjectModel
- Prop
- Schema

## God Nodes (most connected - your core abstractions)
1. `TailwindConfigGenerator` - 58 edges
2. `TestTailwindConfigGenerator` - 35 edges
3. `ShadcnInstaller` - 34 edges
4. `TestShadcnInstaller` - 26 edges
5. `compilerOptions` - 22 edges
6. `User` - 17 edges
7. `react` - 17 edges
8. `color` - 15 edges
9. `InventoryService` - 14 edges
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

## Communities (130 total, 53 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.06
Nodes (32): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, App(), ThemeToggle(), BatchHistoryPage() (+24 more)

### Community 1 - "gray"
Cohesion: 0.05
Nodes (53): $type, $value, $type, $value, $type, $value, $type, $value (+45 more)

### Community 2 - "app.module.ts"
Cohesion: 0.19
Nodes (9): AppController, Controller, Get, AppModule, Module, AppService, Injectable, AuthModule (+1 more)

### Community 3 - "search"
Cohesion: 0.07
Nodes (42): BM25, detect_domain(), get_cip_brief(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection (+34 more)

### Community 4 - "color"
Cohesion: 0.04
Nodes (46): $type, $value, background, destructive, destructive-foreground, foreground, muted, muted-foreground (+38 more)

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

### Community 15 - "persist_design_system"
Cohesion: 0.25
Nodes (8): format_master_md(), persist_design_system(), Slugify a name into a single safe path segment. Only [a-z0-9_-] survives; every…, Persist design system to design-system/<project>/ folder using Master +…, Format design system as MASTER.md with hierarchical override logic., safe_slug(), format_output(), Format results for Claude consumption (token-optimized)

### Community 16 - "inventory.module.ts"
Cohesion: 0.19
Nodes (13): InjectModel, InventoryTransaction, InventoryTransactionSchema, ScrapRule, ScrapRuleSchema, Prop, Schema, StockItem (+5 more)

### Community 17 - "main"
Cohesion: 0.11
Nodes (10): main(), Add custom font families. Args: fonts: Dict of font_type: [font_names] e.g.,…, Add custom spacing values. Args: spacing: Dict of name: value e.g., {'18':…, Add custom breakpoints. Args: breakpoints: Dict of name: width e.g., {'3xl':…, Add plugin requirements. Args: plugins: List of plugin names e.g.,…, Get plugin recommendations based on configuration. Returns: List of recommended…, Generate configuration file content. Returns: Configuration file as string, Write configuration to file. Returns: Tuple of (success, message) (+2 more)

### Community 18 - "DesignSystemGenerator"
Cohesion: 0.16
Nodes (9): DesignSystemGenerator, Find matching reasoning rule for a category., Apply reasoning rules to search results., Select best matching result based on priority keywords., Extract results list from search result dict., Generate complete design system recommendation. variance/motion/density are…, Generates design system recommendations from aggregated searches., Load reasoning rules from CSV. (+1 more)

### Community 19 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, dotenv, jsonwebtoken, mongoose, @nestjs/common, @nestjs/core, @nestjs/mongoose, @nestjs/platform-express (+11 more)

### Community 20 - "fetch-background.py"
Cohesion: 0.17
Nodes (17): generate_css_for_background(), get_background_image(), get_curated_images(), get_overlay_css(), get_pexels_search_url(), load_backgrounds_config(), load_brand_colors(), main() (+9 more)

### Community 21 - "User"
Cohesion: 0.18
Nodes (10): JwtAuthGuard, Injectable, CurrentUser, Prop, Schema, User, UserSchema, Injectable (+2 more)

### Community 22 - "icon/generate.py"
Cohesion: 0.20
Nodes (15): apply_color(), apply_viewbox_size(), extract_svgs(), generate_batch(), generate_icon(), generate_sizes(), load_env(), main() (+7 more)

### Community 23 - "fontSize"
Cohesion: 0.12
Nodes (16): $type, $value, $type, $value, $type, $value, $type, $value (+8 more)

### Community 24 - "TestShadcnInstaller"
Cohesion: 0.16
Nodes (7): Test adding components in dry run mode., Test ShadcnInstaller class., Test initialization with dry run mode., Test checking for existing shadcn config., Test getting installed components when none exist., Test getting installed components without config., TestShadcnInstaller

### Community 25 - "BatchesService"
Cohesion: 0.15
Nodes (10): BatchesController, BatchesService, Body, Controller, CurrentUser, Get, Injectable, InjectModel (+2 more)

### Community 26 - "batches.module.ts"
Cohesion: 0.20
Nodes (10): Batch, BatchSchema, Prop, Schema, BatchesModule, Module, InventoryModule, Module (+2 more)

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
Nodes (8): Path, Handle shadcn/ui component installation., Initialize installer. Args: project_root: Project root directory (default:…, ShadcnInstaller, Test adding components without shadcn config., Test listing installed components when none exist., Test initialization with custom project root., Test checking for non-existent shadcn config.

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

### Community 36 - "duration"
Cohesion: 0.20
Nodes (10): fast, normal, slow, $type, $value, $type, $value, duration (+2 more)

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
Nodes (8): $type, $value, $type, $value, radius, default, full, default

### Community 50 - "._generate_javascript"
Cohesion: 0.29
Nodes (4): Generate TypeScript configuration., Generate JavaScript configuration., Format plugins array for config. Validates each plugin name against a strict…, Add indentation to JSON string.

### Community 51 - "design_system.py"
Cohesion: 0.18
Nodes (14): ansi_ljust(), format_ascii_box(), format_markdown(), generate_design_system(), hex_to_ansi(), Convert hex color to ANSI True Color swatch (██) with fallback., Like str.ljust but accounts for zero-width ANSI escape sequences., Create a Unicode section separator: ├─── NAME ───...┤ (+6 more)

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
Nodes (7): devDependencies, eslint, @eslint/eslintrc, @types/jsonwebtoken, eslint, @eslint/eslintrc, @types/jsonwebtoken

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

### Community 62 - "auth.module.ts"
Cohesion: 0.21
Nodes (7): AuthController, Body, Controller, Post, AuthService, Injectable, HttpCode

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

### Community 70 - "companies.module.ts"
Cohesion: 0.19
Nodes (9): CompaniesModule, Module, CompaniesService, Injectable, InjectModel, Company, CompanySchema, Prop (+1 more)

### Community 86 - "🛠️ 2. Complete Terminal Command Reference"
Cohesion: 0.14
Nodes (13): 💡 1. How Graphify Eliminates Token Wastage, 🛠️ 2. Complete Terminal Command Reference, 🔄 3. Recommended Vibe Coding Workflow, 📂 4. Output File Cheat-Sheet, 🚀 A. One-Time Setup Commands, 📦 B. Building & Updating the Graph, 👁️ C. Continuous Watch Mode (Real-Time Auto Update), 📊 D. Generating Visualizations & Diagrams (+5 more)

### Community 89 - "_generate_intelligent_overrides"
Cohesion: 0.33
Nodes (6): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides(), Format a page-specific override file with intelligent AI-generated content., Generate intelligent overrides based on page type using layered search. Uses…, Detect page type from context and search results.

### Community 116 - "primitive"
Cohesion: 0.50
Nodes (3): dark, primitive, $schema

### Community 117 - "xl"
Cohesion: 0.67
Nodes (4): xl, xl, $type, $value

## Knowledge Gaps
- **264 isolated node(s):** `The Problem with Traditional Vibe Coding`, `The Graphify Solution`, `🚀 A. One-Time Setup Commands`, `📦 B. Building & Updating the Graph`, `👁️ C. Continuous Watch Mode (Real-Time Auto Update)` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `primitive` connect `primitive` to `gray`, `duration`, `spacing`, `radius`, `fontSize`, `shadow`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `color` connect `color` to `button`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `semantic` connect `color` to `primitive`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TailwindConfigGenerator` (e.g. with `TestGeneratedConfigIsValidJs` and `TestTailwindConfigGenerator`) actually correct?**
  _`TailwindConfigGenerator` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `The Problem with Traditional Vibe Coding`, `The Graphify Solution`, `🚀 A. One-Time Setup Commands` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06001984126984127 - nodes in this community are weakly interconnected._
- **Should `gray` be split into smaller, more focused modules?**
  _Cohesion score 0.05370101596516691 - nodes in this community are weakly interconnected._