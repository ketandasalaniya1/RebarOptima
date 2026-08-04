# RebarOptima Codebase Knowledge Graph (Graphify Report)

Generated: 2026-08-01

## 1. Project Overview & Architecture Map

RebarOptima is a monorepo containing a **NestJS (MongoDB/Mongoose)** backend and a **Vite / React** frontend.

```mermaid
graph TD
    Client[Browser / Client] -->|HTTP / REST API| FE[Frontend - React + Vite]
    FE -->|API Requests / JWT| BE[Backend - NestJS]
    BE -->|Mongoose ODM| DB[(MongoDB Atlas / Local)]

    subgraph Backend Modules
        BE --> AuthMod[AuthModule]
        BE --> UsersMod[UsersModule]
        BE --> CompMod[CompaniesModule]
        BE --> InvMod[InventoryModule]
        BE --> BatchMod[BatchesModule]
    end

    subgraph Frontend Routes & Pages
        FE --> AuthPages[SignIn / SignUp / SuperadminLogin]
        FE --> Dashboard[OverviewPage / ResultsPage]
        FE --> CorePages[NewBatchPage / BatchHistoryPage / InventoryPage / LedgerPage / SettingsPage]
    end
```

---

## 2. Backend Module Dependency Graph

```mermaid
graph LR
    AppModule --> AuthModule
    AppModule --> UsersModule
    AppModule --> CompaniesModule
    AppModule --> InventoryModule
    AppModule --> BatchesModule

    AuthModule --> UsersModule
    AuthModule --> CompaniesModule
    UsersModule --> Mongoose[(User Schema)]
    CompaniesModule --> Mongoose[(Company Schema)]
    InventoryModule --> Mongoose[(StockItem / ScrapRule Schemas)]
    BatchesModule --> Mongoose[(Batch / InventoryTransaction Schemas)]
```

---

## 3. Data Schemas & Relationships

| Entity Schema | Collection | Key Fields | Associated Modules |
| :--- | :--- | :--- | :--- |
| **User** | `users` | `email`, `passwordHash`, `role`, `companyId` | `UsersModule`, `AuthModule` |
| **Company** | `companies` | `name`, `licenseKey`, `status`, `createdAt` | `CompaniesModule` |
| **StockItem** | `stockitems` | `companyId`, `grade`, `diameter`, `length`, `quantity` | `InventoryModule` |
| **ScrapRule** | `scraprules` | `companyId`, `minScrapLength`, `maxScrapLength` | `InventoryModule` |
| **Batch** | `batches` | `companyId`, `batchCode`, `orders`, `cuttingPlan`, `scrapGenerated` | `BatchesModule` |
| **InventoryTransaction** | `inventorytransactions` | `companyId`, `type`, `itemId`, `quantity` | `InventoryModule`, `BatchesModule` |

---

## 4. Frontend Component & Page Map

```mermaid
graph TD
    App[App.jsx] --> Router[React Router]
    Router --> SignIn[SignInPage]
    Router --> SignUp[SignUpPage]
    Router --> Overview[OverviewPage]
    Router --> NewBatch[NewBatchPage]
    Router --> Results[ResultsPage]
    Router --> History[BatchHistoryPage]
    Router --> Inventory[InventoryPage]
    Router --> Ledger[LedgerPage]
    Router --> Settings[SettingsPage]
    Router --> SuperAdmin[SuperadminDashboard]
```

---

## 5. Hub Nodes ("God Nodes")

1. **`backend/src/app.module.ts`**: Central root module connecting Mongoose, Auth, Users, Companies, Inventory, and Batches modules.
2. **`backend/src/main.ts`**: Entry point configuring CORS, NestJS bootstrap, and global filters/pipes.
3. **`frontend/src/App.jsx`**: Root routing table managing app state, layout wrappers, and navigation paths.
