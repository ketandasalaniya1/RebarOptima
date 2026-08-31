# Graph Report - RebarOptima  (2026-09-01)

## Corpus Check
- 175 files · ~248,423 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2467 nodes · 3008 edges · 215 communities (149 shown, 59 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a62d931f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- gray
- batches.service.ts
- search
- color
- card
- slide_search_core.py
- spacing
- html-token-validator.py
- TestTailwindConfigGenerator
- BM25
- InventoryService
- compilerOptions
- generate-slide.py
- .test_add_fonts
- design_system.py
- inventory.module.ts
- TailwindConfigGenerator
- DesignSystemGenerator
- dependencies
- fetch-background.py
- User
- icon/generate.py
- fontSize
- TestShadcnInstaller
- BatchesService
- Tailwind CSS Utility Reference
- extract-colors.cjs
- validate-asset.cjs
- .check_shadcn_config
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
- Brand Guidelines v1.0
- logo/generate.py
- generate-tokens.cjs
- ._base_config
- Design
- sync-brand-to-tokens.cjs
- _run
- BM25
- jest
- color
- .generate_config_string
- format_ascii_box
- main.ts
- exclude
- scripts
- backend/package.json
- devDependencies
- Canvas Design System
- Prerequisites
- design-tokens-starter.json
- nest-cli.json
- button
- app.module.ts
- batches.module.ts
- NewBatchPage.jsx
- is_server_ready
- moduleFileExtensions
- test_sync_brand_to_tokens.py
- main
- Form & Input Components
- Tailwind CSS Responsive Design
- Typography Specifications
- Logo Usage Rules
- Component Specifications
- .test_recommend_plugins
- .test_recommend_plugins_nextjs
- .test_generate_config_with_colors
- .test_validate_config_valid
- shadcn/ui Accessibility Patterns
- Asset Approval Checklist
- .test_write_config_invalid_path
- Logo AI Prompt Engineering
- Color Palette Management
- CIP Deliverable Guide
- 🛠️ 2. Complete Terminal Command Reference
- rxjs
- States and Variants
- UI Styling Skill
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
- permissionsSlice.js
- input
- Workflow
- .test_add_components_no_components
- Design System
- Tailwind CSS Customization
- Routing by Task Type
- shadcn/ui Theming & Customization
- Asset Organization Guide
- Primary Color Meanings
- Core Logo Types
- Brand Consistency Checklist
- CIP Mockup Prompt Engineering
- Color Semantics
- Design Principles
- Design Principles
- CIP Design Reference
- Icon Design Reference
- Copywriting Formulas
- Copywriting Formulas
- Banner Design - Multi-Format Creative Banner System
- Messaging Framework
- Brand Voice Framework
- Layout Patterns
- Tailwind Integration
- Layout Patterns
- update.md
- Logo Design Reference
- Token Architecture
- Primitive Tokens
- Core Visual Elements
- CIP Design Style Guide
- Brand
- Slide Strategies
- Component Tokens
- SettingsPage.jsx
- Slide Strategies
- backend/README.md
- Ponytail
- RebarOptima Project Overview
- api.js
- Ponytail Help
- Web Application Testing
- Slides Reference
- HTML Slide Template
- HTML Slide Template
- RebarOptima Codebase Knowledge Graph (Graphify Report)
- Slides
- Brand Guidelines Template
- ResultsPage.jsx
- InventoryPage.jsx
- ponytail-audit/SKILL.md
- Ponytail Gain
- ponytail-review/SKILL.md
- AGENTS.md
- ponytail-debt/SKILL.md
- React + Vite
- .oxlintrc.json
- SuperadminDashboard.jsx
- $type
- $type
- .temp_project
- .test_init_default_project_root
- .__init__
- rules/graphify.md
- slides-create.md
- create.md
- .test_add_components_no_config
- .test_check_shadcn_config_exists
- .test_get_installed_components_empty
- .test_init_dry_run
- .test_init_default_typescript
- .test_generate_javascript_config
- .test_full_configuration_typescript
- .test_base_config_structure
- .test_default_content_paths_react
- workflows/graphify.md
- .test_get_installed_components_with_files
- .test_generate_config_with_plugins
- $type
- .test_validate_config_no_content
- .test_write_config_creates_content
- .test_default_output_path_typescript
- .test_default_content_paths_vue
- format_output
- dotenv
- @eslint/eslintrc
- radius
- 50
- 800
- padding-y
- 950
- destructive
- destructive-foreground
- muted
- primary-foreground
- ring
- secondary-foreground

## God Nodes (most connected - your core abstractions)
1. `TailwindConfigGenerator` - 58 edges
2. `TestTailwindConfigGenerator` - 35 edges
3. `ShadcnInstaller` - 34 edges
4. `TestShadcnInstaller` - 26 edges
5. `User` - 24 edges
6. `compilerOptions` - 22 edges
7. `react` - 22 edges
8. `UI Styling Skill` - 17 edges
9. `CurrentUser` - 16 edges
10. `color` - 15 edges

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

## Communities (215 total, 59 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.30
Nodes (8): ScrollToTop(), SideNavbar(), ThemeToggle(), SignInPage(), SignUpPage(), SuperadminLoginPage(), authApi, react

### Community 1 - "gray"
Cohesion: 0.12
Nodes (16): $type, $value, $type, $value, $type, $value, $type, $value (+8 more)

### Community 2 - "batches.service.ts"
Cohesion: 0.40
Nodes (7): BarLayout, OptimizationResult, OptimizerOptions, PartInputRow, PartLayoutItem, solve1DCSP(), StockInputRow

### Community 3 - "search"
Cohesion: 0.07
Nodes (42): BM25, detect_domain(), get_cip_brief(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection (+34 more)

### Community 4 - "color"
Cohesion: 0.11
Nodes (19): $type, $value, background, foreground, muted-foreground, primary, primary-hover, secondary (+11 more)

### Community 5 - "card"
Cohesion: 0.20
Nodes (12): $type, $value, bg, bg, padding, shadow, card, bg (+4 more)

### Community 6 - "slide_search_core.py"
Cohesion: 0.08
Nodes (36): format_context(), format_result(), main(), Format a single search result for display, Format contextual recommendations for display., BM25, calculate_pattern_break(), detect_domain() (+28 more)

### Community 7 - "spacing"
Cohesion: 0.06
Nodes (34): $type, $value, $type, $value, $type, $value, $type, $value (+26 more)

### Community 8 - "html-token-validator.py"
Cohesion: 0.13
Nodes (24): get_context(), is_allowed_exception(), is_allowed_rgba(), is_inside_block(), load_css_variables(), main(), print_result(), print_summary() (+16 more)

### Community 9 - "TestTailwindConfigGenerator"
Cohesion: 0.06
Nodes (16): Test adding colors multiple times., Test adding full color palette., Test adding custom spacing., Test adding custom breakpoints., Test TailwindConfigGenerator class., Test generating TypeScript configuration., Test validating config with empty theme extensions., Test writing configuration to file. (+8 more)

### Community 10 - "BM25"
Cohesion: 0.11
Nodes (19): BM25, detect_domain(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection, Search across all domains and combine results (+11 more)

### Community 11 - "InventoryService"
Cohesion: 0.13
Nodes (10): InventoryController, Body, Controller, Delete, Get, Param, Post, UseGuards (+2 more)

### Community 12 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 13 - "generate-slide.py"
Cohesion: 0.15
Nodes (19): _e(), generate_chart_slide(), generate_cta_slide(), generate_deck(), generate_metrics_slide(), generate_problem_slide(), generate_solution_slide(), generate_testimonial_slide() (+11 more)

### Community 15 - "design_system.py"
Cohesion: 0.18
Nodes (16): _detect_page_type(), format_markdown(), format_master_md(), format_page_override_md(), generate_design_system(), _generate_intelligent_overrides(), persist_design_system(), Format a page-specific override file with intelligent AI-generated content. (+8 more)

### Community 16 - "inventory.module.ts"
Cohesion: 0.17
Nodes (14): InjectModel, InjectModel, InventoryTransaction, InventoryTransactionSchema, Prop, Schema, ScrapRule, ScrapRuleSchema (+6 more)

### Community 17 - "TailwindConfigGenerator"
Cohesion: 0.10
Nodes (12): main(), Add custom font families. Args: fonts: Dict of font_type: [font_names] e.g.,…, Add custom spacing values. Args: spacing: Dict of name: value e.g., {'18':…, Add custom breakpoints. Args: breakpoints: Dict of name: width e.g., {'3xl':…, Add plugin requirements. Args: plugins: List of plugin names e.g.,…, Get plugin recommendations based on configuration. Returns: List of recommended…, Generate Tailwind CSS configuration files., Validate configuration. Returns: Tuple of (valid, message) (+4 more)

### Community 18 - "DesignSystemGenerator"
Cohesion: 0.14
Nodes (11): DesignSystemGenerator, Find matching reasoning rule for a category., Apply reasoning rules to search results., Select best matching result based on priority keywords., Extract results list from search result dict., Generate complete design system recommendation. variance/motion/density are…, Bucket a 1-10 dial value into its tier config. Returns None if value is None., Generates design system recommendations from aggregated searches. (+3 more)

### Community 19 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, bcryptjs, jsonwebtoken, mongoose, @nestjs/common, @nestjs/core, @nestjs/mongoose, @nestjs/platform-express (+11 more)

### Community 20 - "fetch-background.py"
Cohesion: 0.17
Nodes (17): generate_css_for_background(), get_background_image(), get_curated_images(), get_overlay_css(), get_pexels_search_url(), load_backgrounds_config(), load_brand_colors(), main() (+9 more)

### Community 21 - "User"
Cohesion: 0.19
Nodes (10): JwtAuthGuard, Injectable, CurrentUser, Prop, Schema, User, UserSchema, Injectable (+2 more)

### Community 22 - "icon/generate.py"
Cohesion: 0.20
Nodes (15): apply_color(), apply_viewbox_size(), extract_svgs(), generate_batch(), generate_icon(), generate_sizes(), load_env(), main() (+7 more)

### Community 23 - "fontSize"
Cohesion: 0.06
Nodes (47): $type, $value, $type, $value, $type, $value, $type, $value (+39 more)

### Community 24 - "TestShadcnInstaller"
Cohesion: 0.12
Nodes (9): Test adding components in dry run mode., Test ShadcnInstaller class., Test adding all components without config., Test adding all components in dry run mode., Test listing installed components without config., Test listing installed components when none exist., Test initialization with custom project root., Test checking for non-existent shadcn config. (+1 more)

### Community 25 - "BatchesService"
Cohesion: 0.10
Nodes (15): Batch, Prop, Schema, BatchesController, Body, Controller, Delete, Get (+7 more)

### Community 26 - "Tailwind CSS Utility Reference"
Cohesion: 0.05
Nodes (43): Arbitrary Values, Aspect Ratio, Background Colors, Border Color, Border Radius, Border Style, Border Width, Borders (+35 more)

### Community 27 - "extract-colors.cjs"
Cohesion: 0.22
Nodes (11): calculateCompliance(), colorDistance(), displayPalette(), extractHexColors(), findNearestBrandColor(), fs, generateImageMagickCommand(), hexToRgb() (+3 more)

### Community 28 - "validate-asset.cjs"
Cohesion: 0.25
Nodes (13): checkManifest(), formatBytes(), formatOutput(), fs, main(), parseFilename(), path, RULES (+5 more)

### Community 29 - ".check_shadcn_config"
Cohesion: 0.21
Nodes (6): Add all available shadcn/ui components. Args: overwrite: If True, overwrite…, List installed components. Returns: Tuple of (success, message with component…, Check if shadcn is initialized in project. Returns: True if components.json…, Get list of already installed components. Returns: List of installed component…, Read shadcn version from project package.json; fall back to a pinned default., Add shadcn/ui components. Args: components: List of component names to add…

### Community 30 - "ShadcnInstaller"
Cohesion: 0.20
Nodes (7): main(), Handle shadcn/ui component installation., ShadcnInstaller, Tests for shadcn_add.py, Test adding components that are already installed., Test listing installed components when they exist., Test getting installed components without config.

### Community 31 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, format, lint, start, start:debug, start:dev, start:prod (+5 more)

### Community 32 - "validate-tokens.cjs"
Cohesion: 0.24
Nodes (11): extensions, formatReport(), fs, getFiles(), main(), parseArgs(), path, patterns (+3 more)

### Community 33 - "test_tailwind_config_gen.py"
Cohesion: 0.22
Nodes (8): Tests for tailwind_config_gen.py, Reduce a generated TS/JS config to a bare assignable object so it can be handed…, Regression guard for the missing-comma bug between the ``theme`` block and…, The property preceding ``plugins`` must end with a comma (pure-Python check, so…, The emitted config parses as valid JS via ``node --check``., _strip_to_object(), TestGeneratedConfigIsValidJs, parametrize

### Community 34 - "inject-brand-context.cjs"
Cohesion: 0.31
Nodes (10): extractColorsFromTable(), extractCoreAttributes(), extractHexColors(), extractImageStyle(), extractTypography(), extractVoice(), fs, generatePromptAddition() (+2 more)

### Community 35 - "embed-tokens.cjs"
Cohesion: 0.18
Nodes (8): args, fs, minimal, MINIMAL_TOKENS, path, projectRoot, tokensPath, wrapStyle

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
Cohesion: 0.05
Nodes (37): dependencies, html2pdf.js, lucide-react, react, react-dom, react-redux, react-to-print, @reduxjs/toolkit (+29 more)

### Community 40 - "Brand Guidelines v1.0"
Cohesion: 0.05
Nodes (37): 1. Color Palette, 2. Typography, 3. Logo Usage, 4. Voice & Tone, 5. Imagery Guidelines, 6. Design Components, Accessibility, AI Image Generation (+29 more)

### Community 41 - "logo/generate.py"
Cohesion: 0.29
Nodes (9): enhance_prompt(), generate_batch(), generate_logo(), load_env(), main(), Enhance the logo prompt with style and industry modifiers, Generate a logo using Gemini models with image generation Args: aspect_ratio:…, Generate multiple logo variants with different styles (+1 more)

### Community 42 - "generate-tokens.cjs"
Cohesion: 0.36
Nodes (9): flattenTokens(), fs, generateCSS(), generateTailwind(), main(), parseArgs(), path, resolveReference() (+1 more)

### Community 43 - "._base_config"
Cohesion: 0.22
Nodes (6): Path, Initialize generator. Args: typescript: If True, generate .ts config, else .js…, Determine default output path., Create base configuration structure., Get default content paths for framework., Any

### Community 44 - "Design"
Cohesion: 0.06
Nodes (35): Banner Design (Built-in), Banner: Design Rules, Banner: Quick Size Reference, Banner: Top Art Styles, Banner: Workflow, CIP Design (Built-in), CIP: Generate Brief, CIP: Generate Mockups (+27 more)

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

### Community 49 - "color"
Cohesion: 0.20
Nodes (15): $type, $value, 500, blue, green, red, white, yellow (+7 more)

### Community 50 - ".generate_config_string"
Cohesion: 0.20
Nodes (6): Generate configuration file content. Returns: Configuration file as string, Generate TypeScript configuration., Generate JavaScript configuration., Format plugins array for config. Validates each plugin name against a strict…, Add indentation to JSON string., Write configuration to file. Returns: Tuple of (success, message)

### Community 51 - "format_ascii_box"
Cohesion: 0.25
Nodes (8): ansi_ljust(), format_ascii_box(), hex_to_ansi(), Convert hex color to ANSI True Color swatch (██) with fallback., Like str.ljust but accounts for zero-width ANSI escape sequences., Create a Unicode section separator: ├─── NAME ───...┤, Format design system as Unicode box with ANSI color swatches., section_header()

### Community 52 - "main.ts"
Cohesion: 0.11
Nodes (13): AccessResult, app, canAccess(), connectDB(), DEFAULT_SUBSCRIPTION_PACKAGES, DEFAULT_SYSTEM_ROLES, logAudit(), PLATFORM_MODULES (+5 more)

### Community 53 - "exclude"
Cohesion: 0.25
Nodes (7): exclude, extends, dist, node_modules, **/*spec.ts, test, ./tsconfig.json

### Community 54 - "scripts"
Cohesion: 0.10
Nodes (19): allowScripts, lucide-react@1.25.0, dependencies, lucide-react, @vercel/analytics, lucide-react, @vercel/analytics, name (+11 more)

### Community 55 - "backend/package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 56 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, eslint, eslint-config-prettier, @types/jsonwebtoken, eslint, eslint-config-prettier, @types/jsonwebtoken

### Community 57 - "Canvas Design System"
Cohesion: 0.06
Nodes (35): 1. Visual Communication First, 2. Minimal Text Integration, 3. Expert Craftsmanship, 4. Systematic Patterns, Analog Meditation, Approach, Canvas Boundaries, Canvas Design System (+27 more)

### Community 58 - "Prerequisites"
Cohesion: 0.06
Nodes (33): Accessibility, Available Domains, Available Stacks, Common Rules for Professional UI, Common Sticking Points, Example Workflow, How to Use This Skill, Icons & Visual Elements (+25 more)

### Community 59 - "design-tokens-starter.json"
Cohesion: 0.15
Nodes (12): component, $type, $value, dark, semantic, $schema, $type, $value (+4 more)

### Community 60 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 61 - "button"
Cohesion: 0.20
Nodes (10): fg, font-size, hover-bg, button, $type, $value, $type, $value (+2 more)

### Community 62 - "app.module.ts"
Cohesion: 0.07
Nodes (27): AppController, Controller, Get, AppModule, Module, AppService, Injectable, AuthController (+19 more)

### Community 63 - "batches.module.ts"
Cohesion: 0.33
Nodes (5): BatchSchema, InventoryModule, Module, Module, UsersModule

### Community 64 - "NewBatchPage.jsx"
Cohesion: 0.40
Nodes (4): initialParts, initialStock, NewBatchPage(), useTableRows()

### Community 65 - "is_server_ready"
Cohesion: 0.67
Nodes (3): is_server_ready(), main(), Wait for server to be ready by polling the port.

### Community 66 - "moduleFileExtensions"
Cohesion: 0.50
Nodes (4): moduleFileExtensions, js, json, ts

### Community 69 - "Form & Input Components"
Cohesion: 0.06
Nodes (32): Accordion, Alert, Alert Dialog, Avatar, Badge, Button, Card, Checkbox (+24 more)

### Community 70 - "Tailwind CSS Responsive Design"
Cohesion: 0.06
Nodes (32): 1. Mobile-First Design, 2. Consistent Breakpoint Usage, 3. Test at Breakpoint Boundaries, 4. Use Container for Content Width, 5. Progressive Enhancement, 6. Avoid Too Many Breakpoints, Best Practices, Breakpoint System (+24 more)

### Community 71 - "Typography Specifications"
Cohesion: 0.06
Nodes (30): Accessibility, Base System, Best Practices, Clean & Modern, Common Font Pairings, Contrast Requirements, CSS Implementation, Editorial (+22 more)

### Community 72 - "Logo Usage Rules"
Cohesion: 0.07
Nodes (28): Absolute Don'ts, Approved Backgrounds, Before Using Logo, Clear Space, Co-branding, Color Rules, Color Usage, Color Variants (+20 more)

### Community 74 - "Component Specifications"
Cohesion: 0.07
Nodes (28): Alert, Anatomy, Anatomy, Anatomy, Anatomy, Anatomy, Badge, Button (+20 more)

### Community 79 - "shadcn/ui Accessibility Patterns"
Cohesion: 0.07
Nodes (28): Accordion, Alert, ARIA Labels, Checkbox and Radio, Color Contrast, Command Palette Navigation, Component-Specific Patterns, Dialog/Modal Navigation (+20 more)

### Community 80 - "Asset Approval Checklist"
Cohesion: 0.08
Nodes (25): Accessibility, Archival, Asset Approval Checklist, Automation Support, Color Compliance, Common Issues & Fixes, Content Accessibility, Content Quality (+17 more)

### Community 82 - "Logo AI Prompt Engineering"
Cohesion: 0.08
Nodes (25): Common Pitfalls, Core Prompt Structure, Detailed Brief, Eco/Sustainable, Effective Keywords by Style, Fashion Brand, Healthcare, Industry-Specific Prompts (+17 more)

### Community 83 - "Color Palette Management"
Cohesion: 0.08
Nodes (24): Accessibility Requirements, Brand Compliance Validation, Checking Contrast, Color Documentation Format, Color Extraction, Color Palette Examples, Color Palette Management, Color System Structure (+16 more)

### Community 84 - "CIP Deliverable Guide"
Cohesion: 0.08
Nodes (24): Apparel, Business Card, Car/Sedan, CIP Deliverable Guide, Core Identity, Digital Assets, Email Signature, Envelope (+16 more)

### Community 86 - "🛠️ 2. Complete Terminal Command Reference"
Cohesion: 0.14
Nodes (13): 💡 1. How Graphify Eliminates Token Wastage, 🛠️ 2. Complete Terminal Command Reference, 🔄 3. Recommended Vibe Coding Workflow, 📂 4. Output File Cheat-Sheet, 🚀 A. One-Time Setup Commands, 📦 B. Building & Updating the Graph, 👁️ C. Continuous Watch Mode (Real-Time Auto Update), 📊 D. Generating Visualizations & Diagrams (+5 more)

### Community 88 - "States and Variants"
Cohesion: 0.08
Nodes (24): Accessibility, Accessibility Requirements, ARIA States, Color Contrast, Color Variants, Disabled States, Error Messages, Error States (+16 more)

### Community 89 - "UI Styling Skill"
Cohesion: 0.08
Nodes (24): Accessibility Patterns, Alternative: Tailwind-Only Setup, Best Practices, Common Patterns, Component Layer: shadcn/ui, Component Library Guide, Component + Styling Setup, Core Stack (+16 more)

### Community 117 - "input"
Cohesion: 0.29
Nodes (8): padding-x, input, $type, $value, focus-ring, padding-x, $type, $value

### Community 118 - "Workflow"
Cohesion: 0.08
Nodes (23): Art Direction Styles (Reuse from Banner), Color & Contrast, Design Best Practices, HTML Design Rules, HTML Template Structure, Option A: Chrome Headless CLI (Recommended — zero dependencies), Option B: chrome-devtools skill, Option C: Playwright script (+15 more)

### Community 120 - "Design System"
Cohesion: 0.09
Nodes (22): Best Practices, Chart.js Integration, Command, Component Spec Pattern, Contextual Decision Flow, Decision System CSVs, Design System, Integration (+14 more)

### Community 121 - "Tailwind CSS Customization"
Cohesion: 0.09
Nodes (22): @apply Directive, Best Practices, Color Customization, Complete Tailwind Config, Configuration Examples, Content Configuration, Custom Color Palette, Custom Font Sizes (+14 more)

### Community 122 - "Routing by Task Type"
Cohesion: 0.10
Nodes (19): Banner Design Tasks, Brand Identity Tasks, Component Creation, Corporate Identity Program Tasks, Design Routing Guide, Design System Migration, Icon Design Tasks, Implementation Tasks (+11 more)

### Community 123 - "shadcn/ui Theming & Customization"
Cohesion: 0.10
Nodes (19): Base Color Presets, Best Practices, Color Customization, Color Format, Component Customization, CSS Variable System, Customize Styles, Customize Variants (+11 more)

### Community 124 - "Asset Organization Guide"
Cohesion: 0.11
Nodes (18): Asset Entry (manifest.json), Asset Organization Guide, By Campaign, By Status, By Type, Cleanup Workflow, Components, Directory Structure (+10 more)

### Community 125 - "Primary Color Meanings"
Cohesion: 0.11
Nodes (18): Accessibility Considerations, Analogous, Black, Blue, Color Combinations by Industry, Color Harmony Types, Complementary, Green (+10 more)

### Community 126 - "Core Logo Types"
Cohesion: 0.11
Nodes (18): 1. Wordmark (Logotype), 2. Lettermark (Monogram), 3. Pictorial Mark (Brand Mark), 4. Abstract Mark, 5. Mascot, 6. Emblem, 7. Combination Mark, Aesthetic Styles (+10 more)

### Community 127 - "Brand Consistency Checklist"
Cohesion: 0.11
Nodes (17): Audit Frequency, Brand Consistency Checklist, Channel Audit, Collateral, Colors, Common Issues, Email, Imagery (+9 more)

### Community 128 - "CIP Mockup Prompt Engineering"
Cohesion: 0.11
Nodes (17): Apparel (Polo/T-Shirt), Base Prompt Structure, Business Card, CIP Mockup Prompt Engineering, Context Modifiers, Corporate Minimal, Deliverable-Specific Modifiers, Letterhead (+9 more)

### Community 129 - "Color Semantics"
Cohesion: 0.11
Nodes (17): Accent, Applying Semantic Tokens, Background & Foreground, Border & Ring, Color Semantics, Dark Mode Overrides, Destructive, Interactive States (+9 more)

### Community 130 - "Design Principles"
Cohesion: 0.12
Nodes (15): 22 Art Direction Styles, Banner Sizes & Art Direction Styles Reference, Complete Banner Sizes, CTA Rules, Design Principles, Pinterest Research Queries, Print, Print Specs (+7 more)

### Community 131 - "Design Principles"
Cohesion: 0.12
Nodes (15): 22 Art Direction Styles, Banner Sizes & Art Direction Styles Reference, Complete Banner Sizes, CTA Rules, Design Principles, Pinterest Research Queries, Print, Print Specs (+7 more)

### Community 132 - "CIP Design Reference"
Cohesion: 0.13
Nodes (14): CIP Brief (Start Here), CIP Design Reference, Commands, Deliverable Categories, Design Styles, Detailed References, Generate Mockups, HTML Presentation Features (+6 more)

### Community 133 - "Icon Design Reference"
Cohesion: 0.13
Nodes (14): Available Styles, CLI Options, Commands, Generate Batch Variations, Generate Multiple Sizes, Generate Single Icon, Icon Categories, Icon Design Reference (+6 more)

### Community 134 - "Copywriting Formulas"
Cohesion: 0.13
Nodes (14): AIDA (Attention-Interest-Desire-Action), Before-After-Bridge, Contrast Patterns, Copywriting Formulas, Core Formulas, Cost of Inaction, FAB (Features-Advantages-Benefits), Formula-to-Slide Mapping (+6 more)

### Community 135 - "Copywriting Formulas"
Cohesion: 0.13
Nodes (14): AIDA (Attention-Interest-Desire-Action), Before-After-Bridge, Contrast Patterns, Copywriting Formulas, Core Formulas, Cost of Inaction, FAB (Features-Advantages-Benefits), Formula-to-Slide Mapping (+6 more)

### Community 136 - "Banner Design - Multi-Format Creative Banner System"
Cohesion: 0.14
Nodes (13): Art Direction Styles (Top 10), Banner Design - Multi-Format Creative Banner System, Banner Size Quick Reference, Design Rules, Prerequisites, Security, Step 1: Gather Requirements (AskUserQuestion), Step 2: Research & Art Direction (+5 more)

### Community 137 - "Messaging Framework"
Cohesion: 0.14
Nodes (13): Core Statements, Elevator Pitches, Framework Structure, Message Architecture, Message by Audience, Message Testing, Messaging Framework, Mission Statement (+5 more)

### Community 138 - "Brand Voice Framework"
Cohesion: 0.14
Nodes (13): Brand Voice Framework, Character Spectrum, Emotion Spectrum, Language Spectrum, Step 1: Define Personality Traits, Step 2: Create Voice Chart, Step 3: Context Adaptation, Tone Spectrum (+5 more)

### Community 139 - "Layout Patterns"
Cohesion: 0.14
Nodes (13): Card Styles, Component Variants, CSS Structures, Feature Grid (3 columns), Layout Decision Flow, Layout Patterns, Layout Selection by Use Case, Metric Styles (+5 more)

### Community 140 - "Tailwind Integration"
Cohesion: 0.14
Nodes (13): Animation Tokens, Base Layer, Button Example, Component Classes, CSS Variables Setup, Dark Mode Toggle, HSL Format Benefits, shadcn/ui Alignment (+5 more)

### Community 141 - "Layout Patterns"
Cohesion: 0.14
Nodes (13): Card Styles, Component Variants, CSS Structures, Feature Grid (3 columns), Layout Decision Flow, Layout Patterns, Layout Selection by Use Case, Metric Styles (+5 more)

### Community 142 - "update.md"
Cohesion: 0.15
Nodes (12): Color Presets, Examples, Files Modified, Important, Overview, Skills Used, Step 1: Gather Brand Input, Step 2: Update Brand Guidelines (+4 more)

### Community 143 - "Logo Design Reference"
Cohesion: 0.15
Nodes (12): Available Styles, Color Psychology, Commands, Design Brief (Start Here), Detailed References, Generate Logo, Industry Defaults, Logo Design Reference (+4 more)

### Community 144 - "Token Architecture"
Cohesion: 0.15
Nodes (12): Categories, Dark Mode, File Organization, Layer 1: Primitive Tokens, Layer 2: Semantic Tokens, Layer 3: Component Tokens, Layer Overview, Migration from Flat Tokens (+4 more)

### Community 145 - "Primitive Tokens"
Cohesion: 0.17
Nodes (11): Border Radius, Color Scales, Gray Scale, Motion / Duration, Primary Colors (Blue), Primitive Tokens, Shadows, Spacing Scale (+3 more)

### Community 146 - "Core Visual Elements"
Cohesion: 0.18
Nodes (10): Color Palette, Colors, Core Visual Elements, Logo, Logo, Quick Checks, Typography, Typography (+2 more)

### Community 147 - "CIP Design Style Guide"
Cohesion: 0.18
Nodes (10): Bold Dynamic, CIP Design Style Guide, Classic Traditional, Color Psychology, Corporate Minimal, Fresh Modern, Luxury Premium, Modern Tech (+2 more)

### Community 148 - "Brand"
Cohesion: 0.20
Nodes (9): Brand, Brand Sync Workflow, Quick Start, References, Routing, Scripts, Subcommands, Templates (+1 more)

### Community 149 - "Slide Strategies"
Cohesion: 0.20
Nodes (9): Common Structures, Duarte Sparkline Pattern, Matching Strategy to Context, Product Demo (6 slides), Sales Pitch (9 slides), Search Commands, Slide Strategies, Strategy Selection (+1 more)

### Community 150 - "Component Tokens"
Cohesion: 0.20
Nodes (9): Alert Tokens, Badge Tokens, Button Tokens, Card Tokens, Component Tokens, Dialog/Modal Tokens, Input Tokens, Table Tokens (+1 more)

### Community 151 - "SettingsPage.jsx"
Cohesion: 0.33
Nodes (3): SettingsPage(), settingsSlice, companyApi

### Community 152 - "Slide Strategies"
Cohesion: 0.20
Nodes (9): Common Structures, Duarte Sparkline Pattern, Matching Strategy to Context, Product Demo (6 slides), Sales Pitch (9 slides), Search Commands, Slide Strategies, Strategy Selection (+1 more)

### Community 153 - "backend/README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 154 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 155 - "RebarOptima Project Overview"
Cohesion: 0.22
Nodes (8): 1. Project Purpose & Core Domain, 2. Codebase Architecture, 3. Database Entity Schema Summary, 4. Key Files to Know, 5. Current Implementation Status, A. Frontend (React + Vite), B. Backend (NestJS + Mongoose + MongoDB), RebarOptima Project Overview

### Community 156 - "api.js"
Cohesion: 0.16
Nodes (12): ActivityLogsPage(), ProfilePage(), DATA_SCOPE_OPTIONS, FEATURE_LABELS, MODULE_LABELS, RolesPermissionsPage(), UserManagementPage(), activityLogsApi (+4 more)

### Community 157 - "Ponytail Help"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 158 - "Web Application Testing"
Cohesion: 0.25
Nodes (7): Best Practices, Common Pitfall, Decision Tree: Choosing Your Approach, Example: Using with_server.py, Reconnaissance-Then-Action Pattern, Reference Files, Web Application Testing

### Community 159 - "Slides Reference"
Cohesion: 0.29
Nodes (6): Key Features, Knowledge Base, Slides Reference, Usage, When to Use, Workflow

### Community 160 - "HTML Slide Template"
Cohesion: 0.29
Nodes (6): Animation Classes, Background Images, Base Structure, Chart.js Integration, CSS Variables Reference, HTML Slide Template

### Community 161 - "HTML Slide Template"
Cohesion: 0.29
Nodes (6): Animation Classes, Background Images, Base Structure, Chart.js Integration, CSS Variables Reference, HTML Slide Template

### Community 162 - "RebarOptima Codebase Knowledge Graph (Graphify Report)"
Cohesion: 0.29
Nodes (6): 1. Project Overview & Architecture Map, 2. Backend Module Dependency Graph, 3. Data Schemas & Relationships, 4. Frontend Component & Page Map, 5. Hub Nodes ("God Nodes"), RebarOptima Codebase Knowledge Graph (Graphify Report)

### Community 163 - "Slides"
Cohesion: 0.33
Nodes (5): References (Knowledge Base), Routing, Slides, Subcommands, When to Use

### Community 164 - "Brand Guidelines Template"
Cohesion: 0.40
Nodes (4): Brand Guidelines Template, Document Structure, Extractable Fields, Usage

### Community 165 - "ResultsPage.jsx"
Cohesion: 0.50
Nodes (3): getTextStyle(), mockLayouts, ResultsPage()

### Community 166 - "InventoryPage.jsx"
Cohesion: 0.16
Nodes (10): LoadingSpinner(), BatchHistoryPage(), getTextStyle(), createDefaultVoucherRows(), InventoryPage(), STANDARD_DIAMETERS, LedgerPage(), OverviewPage() (+2 more)

### Community 167 - "ponytail-audit/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 168 - "Ponytail Gain"
Cohesion: 0.40
Nodes (4): Boundaries, Honesty boundary, Ponytail Gain, Scoreboard

### Community 169 - "ponytail-review/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 171 - "ponytail-debt/SKILL.md"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 172 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 173 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 174 - "SuperadminDashboard.jsx"
Cohesion: 0.18
Nodes (6): App(), SuperadminDashboard(), authSlice, routingSlice, store, developerApi

### Community 175 - "$type"
Cohesion: 0.53
Nodes (6): $type, $value, 600, 600, 600, 600

### Community 176 - "$type"
Cohesion: 0.60
Nodes (5): $type, $value, 700, 700, 700

### Community 195 - "$type"
Cohesion: 0.60
Nodes (5): $type, $value, border, border, border

### Community 203 - "radius"
Cohesion: 0.60
Nodes (5): radius, radius, radius, $type, $value

### Community 204 - "50"
Cohesion: 0.67
Nodes (4): $type, $value, 50, 50

### Community 205 - "800"
Cohesion: 0.67
Nodes (4): $type, $value, 800, 800

### Community 206 - "padding-y"
Cohesion: 0.67
Nodes (4): padding-y, padding-y, $type, $value

### Community 208 - "950"
Cohesion: 0.67
Nodes (3): $type, $value, 950

### Community 209 - "destructive"
Cohesion: 0.67
Nodes (3): destructive, $type, $value

### Community 210 - "destructive-foreground"
Cohesion: 0.67
Nodes (3): destructive-foreground, $type, $value

### Community 211 - "muted"
Cohesion: 0.67
Nodes (3): muted, $type, $value

### Community 212 - "primary-foreground"
Cohesion: 0.67
Nodes (3): primary-foreground, $type, $value

### Community 213 - "ring"
Cohesion: 0.67
Nodes (3): ring, $type, $value

### Community 214 - "secondary-foreground"
Cohesion: 0.67
Nodes (3): secondary-foreground, $type, $value

## Knowledge Gaps
- **1130 isolated node(s):** `fs`, `path`, `fs`, `path`, `fs` (+1125 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1503 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `primitive` connect `primitive` to `color`, `design-tokens-starter.json`, `spacing`, `fontSize`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `semantic` connect `design-tokens-starter.json` to `color`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `color` connect `color` to `$type`, `destructive`, `destructive-foreground`, `muted`, `primary-foreground`, `ring`, `secondary-foreground`, `design-tokens-starter.json`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TailwindConfigGenerator` (e.g. with `TestGeneratedConfigIsValidJs` and `TestTailwindConfigGenerator`) actually correct?**
  _`TailwindConfigGenerator` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `fs`, `path`, `fs` to the rest of the system?**
  _1130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `gray` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `search` be split into smaller, more focused modules?**
  _Cohesion score 0.0653061224489796 - nodes in this community are weakly interconnected._