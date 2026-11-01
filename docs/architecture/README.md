# Architecture diagrams

## Rebar-Optima flowchart (Excalidraw)

File: [REBAR_OPTIMA_FLOWCHART.excalidraw](./REBAR_OPTIMA_FLOWCHART.excalidraw)

### How to open

1. Go to [excalidraw.com](https://excalidraw.com)
2. **Menu → Open** (or drag the `.excalidraw` file onto the canvas)
3. Or open with the Excalidraw VS Code / Cursor extension

### What’s covered

1. Auth & App bootstrap  
2. Frontend shell (App, SideNavbar, Redux, modals, pages)  
3. Projects & Blocks detail (`project_blocks`)  
4. API clients (`utils/api.js`)  
5. Express mounts in `main.ts`  
6. MongoDB collections & scope  
7. Module feature flows (Steel, BBS, Casting, CRM, …)  
8. Block unification migration  
9. End-to-end create-project-with-blocks sequence  

### Regenerate

```bash
node docs/architecture/generate-flowchart.js
```
