# ⚡ Graphify & Vibe Coding: Zero-Token-Wastage Guide

This guide details how to eliminate AI token wastage while vibe coding using **Graphify**, along with the complete terminal command reference and workflow runbook.

---

## 💡 1. How Graphify Eliminates Token Wastage

### The Problem with Traditional Vibe Coding
When vibe coding without Graphify, your AI assistant reads dozens of entire files into its context window to understand how code connects.
- **Context Bloat**: Reading 10–20 files per turn burns **30,000–100,000+ tokens per prompt**.
- **High Costs & Rate-Limits**: Context fills up fast, hitting token limits and driving up API costs.
- **Hallucinations**: Massive context windows cause the AI to miss subtle connections hidden in thousands of lines of text.

### The Graphify Solution
Graphify turns your codebase into a lightweight, navigable Knowledge Graph stored on disk (`graphify-out/graph.json`).
1. **Free Local AST Indexing (0 LLM Tokens)**: Graphify uses tree-sitter to parse JavaScript, TypeScript, Python, etc. deterministically locally. **Cost: $0.00 / 0 tokens.**
2. **Precision Context Retrieval**: Instead of loading 50 full files, the AI queries Graphify (`graphify query "..."`) to extract only a **tiny, targeted 500–1,500 token subgraph** containing the exact call paths, imports, and dependencies needed.
3. **90%+ Token Reduction**: Prompt payload drops from **~50,000 tokens** down to **~1,200 tokens**.

---

## 🛠️ 2. Complete Terminal Command Reference

Below are all the commands you will ever need to install, build, watch, query, and visualize your graph.

### 🚀 A. One-Time Setup Commands
Run these once in your project root:

```bash
# 1. Install Graphify integration for Antigravity AI Agent
graphify antigravity install

# 2. Install Git Post-Commit & Post-Checkout hooks
graphify hook install

# 3. Verify hook installation status
graphify hook status
```

---

### 📦 B. Building & Updating the Graph

```bash
# Build code AST graph (Zero LLM Tokens - 100% Free & Local)
graphify extract . --code-only

# Incremental update (re-analyzes only changed files fast)
graphify update .

# Force full re-scan (if files were deleted or major refactoring occurred)
graphify extract . --code-only --force
```

---

### 👁️ C. Continuous Watch Mode (Real-Time Auto Update)
Run this command in a separate background terminal window while vibe coding:

```bash
# Auto-rebuilds graph 3 seconds after you save any file (0 LLM Tokens)
py -m graphify.watch . --debounce 3
```
*Press `Ctrl + C` in that terminal to stop watch mode.*

---

### 📊 D. Generating Visualizations & Diagrams

```bash
# 1. Interactive 2D Force Network Graph (graphify-out/graph.html)
graphify export html

# 2. D3 Collapsible Code Hierarchy Tree (graphify-out/GRAPH_TREE.html)
graphify tree

# 3. Interactive Call-Flow & Sequence Diagrams (graphify-out/<Project>-callflow.html)
graphify export callflow-html
```

---

### 🔍 E. Terminal Query & Codebase Exploration

```bash
# BFS Traversal (Broad architectural context for a question)
graphify query "How does InventoryService handle stock optimization?"

# DFS Traversal (Deep single execution path tracing)
graphify query "Trace batch scrap calculation" --dfs

# Find Shortest Path between two services/classes/files
graphify path "InventoryService" "BatchesController"

# Explain a specific node/symbol in plain language
graphify explain "BatchesService"

# List top architectural hub files (God Nodes)
graphify god-nodes --top 10

# Measure token reduction savings vs full-corpus prompt
graphify benchmark
```

---

## 🔄 3. Recommended Vibe Coding Workflow

Follow this step-by-step workflow for maximum speed and zero token waste:

```
                  ┌─────────────────────────────────────┐
                  │ 1. Start Watcher in Background Terminal│
                  │    py -m graphify.watch .           │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ 2. Prompt Antigravity AI Assistant  │
                  │    "Query Graphify for X & implement"│
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ 3. Assistant Queries graph.json     │
                  │    (Reads ~1k tokens, not 50k)      │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ 4. Code Edits & Save                │
                  │    (Git Hooks & Watcher auto-sync)  │
                  └─────────────────────────────────────┘
```

### Daily Runbook:
1. **Start your dev servers**:
   - Terminal 1: Frontend (`npm run dev`)
   - Terminal 2: Backend (`npm run dev:backend`)
   - Terminal 3: **Graphify Watcher** (`py -m graphify.watch . --debounce 3`)
2. **Vibe Code with AI**:
   - Ask Antigravity to build features or fix bugs. The AI will automatically query `graphify-out/graph.json` before reading source files.
3. **Commit & Sync**:
   - When you run `git commit -m "feat: added new feature"`, Graphify's Git `post-commit` hook automatically re-syncs the graph for your next session.

---

## 📂 4. Output File Cheat-Sheet

| Output File | Purpose | How to Open |
| :--- | :--- | :--- |
| `graphify-out/graph.html` | 2D Interactive Force Graph | Double-click or open in browser |
| `graphify-out/GRAPH_TREE.html` | D3 Collapsible Hierarchy Tree | Double-click or open in browser |
| `graphify-out/RebarOptima-callflow.html` | Architecture & Call-Flow Diagrams | Double-click or open in browser |
| `graphify-out/GRAPH_REPORT.md` | Plain-language codebase report | Open in IDE Markdown viewer |
| `graphify-out/graph.json` | Raw Knowledge Graph for AI agent | Used automatically by AI |

---

> 💡 **Pro-Tip**: You can open `graphify-out/graph.html` or `GRAPH_TREE.html` in your browser alongside your localhost dev app to visually inspect module connections in real-time while building!
