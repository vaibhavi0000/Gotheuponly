# 3D Print Cost & Profit Engine — Partner Portal & Server Sync Architecture

A dedicated 3D print manufacturing calculator and sales profit tracker locked behind secure partner authentication, enabling freeform target selling prices, comprehensive audit trail logging, and persistent server-side synchronization across devices.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during the interactive clarification interview and will govern implementation:

- **Partner Authentication (Zero-Disclosure Login)**: The login page presents three secure credentials fields: **Username**, **Master Password**, and **Partner Passcode**. No partner names or hints are displayed on the login page to preserve privacy.
  - **Master Password**: `50CROREBY2035`
  - **Partner 1**: Username `Aditya`, Passcode `3078`
  - **Partner 2**: Username `Anshuman`, Passcode `7985`
  - Successful login activates a partner session identifying the active partner in the top navigation and stamping all subsequent actions into the audit log.
- **Target Selling Price Error Resolution**: The current `<input type="number">` uses HTML5 `step="10"` which causes browsers to show a blocking validation error ("Please enter a valid value. A valid value is a multiple of 10") whenever custom prices like ₹599, ₹249, or ₹1,295 are entered. We will replace this with `step="any"` and add inline table editing, accepting any custom integer or decimal price seamlessly.
- **Full Website Security Gate**: The entire application is protected behind the secure login portal. Unauthenticated visitors cannot view product specs, sales figures, profit rankings, or custom cost formulas.
- **Server-Side Persistence & Live Synchronization**: Moving beyond local-only browser storage. All products, custom fields, sales counts, and audit logs will persist to dedicated server API endpoints (`/api/calculator/products`, `/api/calculator/audit-logs`) and sync in real time with Firestore (`ai-studio-printhub3dprinti-8373b87d-2a2b-42b2-8d7e-37afc2f322b9`), ensuring Aditya and Anshuman always see identical, real-time data on any device.

---

## 1. Overview & Core Concept

- **What It Does**: A manufacturing cost calculator and profit tracking engine tailored specifically for 3D printing businesses. Users calculate true unit economics (filament weight, hourly machine depreciation, electricity wattage and tariff, labor, post-processing, shipping, platform fees, and custom accessories like magnets or electronics), test custom target selling prices, and track lifetime units sold, revenue, and net profit.
- **Target Audience / Persona**: Business partners Aditya and Anshuman managing 3D print production, pricing, and catalog profit rankings.
- **Key Value**: Eliminates pricing guesswork, allows arbitrary retail prices without form errors, maintains an immutable partner audit trail of who created, edited, or repriced which product, and syncs all changes immediately across devices via server persistence.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Authentication Flow (Zero-Disclosure Portal)**:
   - Visitor navigates to the app and is greeted by a clean, industrial-slate login screen titled **Partner Access Portal**.
   - Inputs: `Username` (text), `Master Password` (password), `Private Passcode` (4-digit numeric PIN).
   - Validation: Verifies that Master Password equals `50CROREBY2035` and the username matches the passcode (`Aditya` + `3078` or `Anshuman` + `7985`). Case-insensitive username match.
   - On success: Emits an audit log entry (`LOGIN`), sets a secure session state, and transitions smoothly into the main dashboard.
2. **Product Calculation & Flexible Pricing Flow**:
   - In the **Cost Calculator** tab, users configure print parameters, material costs, and custom line-item fields (e.g. magnets, brass inserts, custom electronics).
   - The **Target Selling Price** input accepts any custom numeric price without step restrictions. Real-time margin %, markup %, per-unit profit, and breakeven volume recalculate with zero latency.
   - Quick suggested price shortcuts (30%, 50%, 65% margin) remain available as optional 1-click helper buttons.
3. **Sales & Profit Tracker Flow**:
   - The **Sales & Profit Tracker** displays high-level metric summaries (Total Realized Profit, Total Revenue, Total Units Sold, Top Profit Leader) followed by a high-density tabular comparison of all products.
   - Users can inline-edit units sold or click to edit the target selling price directly in the table row.
   - Top earners are highlighted with subtle editorial badges (`★ Top Profit`, `★ High Margin`).
4. **Audit Logs View**:
   - A dedicated **Audit Trail** slide-over or tab accessible from the top bar shows chronological records of all operations:
     - Logins by Aditya or Anshuman
     - Product creations and deletions
     - Price modifications (e.g., `Selling price changed from ₹599 to ₹649 by Aditya`)
     - Sales volume updates (e.g., `Units sold updated from 15 to 25 by Anshuman`)
     - Custom field additions or removals
   - Stored permanently on the server with exact timestamps and partner attributions.

### Visual Identity & Theme (Domain: SaaS & Dashboard)

- **Aesthetic Direction**: Utilitarian, precision industrial engineering dashboard. Clean dark slate and crisp white surfaces with emerald and teal financial accents.
- **Color Palette & Discipline (60-30-10 Rule)**:
  - `60% Neutral Canvas`: Crisp background (`#F8FAFC` slate-50 in light mode, `#0B0F17` dark slate)
  - `30% Structural Surfaces`: Pure white (`#FFFFFF`) card containers, hairline borders (`border-slate-200 / border-slate-800`), and readable dark slate typography (`text-slate-900` / `text-slate-600`)
  - `10% Accent Budget`: Emerald green (`#059669` / `#10B981`) for positive margins, realized profits, and primary action CTAs; amber (`#D97706`) for caution states or top-earner highlights
- **Typography & Tabular Numerals**:
  - Headings: `Plus Jakarta Sans` or modern geometric sans, semi-bold to bold.
  - Body: Clean readable sans with strict line-height.
  - Financial Figures & Metrics: Strictly formatted with tabular figures (`font-mono tabular-nums`) so currency decimals and units align vertically without jitter.
- **Top Bar Contract**:
  - `Zone 1 (Brand)`: Single-line brand mark `3D Print Profit Engine`
  - `Zone 2 (Nav Links)`: `Sales Tracker`, `Cost Calculator`, `Audit Logs`
  - `Zone 3 (Action & Profile)`: Active Partner Indicator (`Aditya` / `Anshuman`) with a clean `Sign Out` button.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Zero-Disclosure Login Interface**
  - *Chosen Approach*: Text input for username instead of a dropdown selector.
  - *Why*: The prompt explicitly mandates: *"do not disclose partner name in admin login page"*. A dropdown or prefilled user button would leak the partner names to anyone seeing the login screen. A freeform text input with private passcode validation keeps partner identities confidential until authenticated.
- **Decision 2: Elimination of HTML5 Form Step Constraints**
  - *Chosen Approach*: Change `<input type="number" step="10">` to `step="any"` and remove synthetic form submit blocking. Provide quick preset buttons as accelerators while keeping the input field completely freeform.
  - *Why*: 3D print makers frequently price items at psychological thresholds like ₹299, ₹499, ₹799, or custom values like ₹345.20. Native browser `step="10"` rejects any non-decade number. `step="any"` accepts all numbers.
- **Decision 3: Dual-Tier Server Synchronization (Express API + Firestore)**
  - *Chosen Approach*: Implement a dual-sync architecture where mutations update both the Express server API storage (`/api/calculator/...` on disk in `data/`) and Firestore collections (`calculator_products` and `calculator_audit_logs`).
  - *Why*: Guarantees zero data loss. Express routes provide reliable local-server JSON persistence, while Firestore provides real-time cross-device broadcast listeners so Aditya and Anshuman see each other's changes immediately without manual page refreshes.
- **Decision 4: Immutable Audit Trail**
  - *Chosen Approach*: Append-only audit log collection tracking actor, action type, entity ID, timestamp, and human-readable description.
  - *Why*: Essential for multi-partner businesses to review who adjusted prices or logged sales batches, ensuring transparency and operational accountability.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION                              │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Auth Gatekeeper                              │  │
│  │   • Master Password (50CROREBY2035)                              │  │
│  │   • Aditya (3078) / Anshuman (7985) Validation                   │  │
│  └───────────────────────────────┬──────────────────────────────────┘  │
│                                  │ (Authenticated Session)             │
│                                  ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      App Shell & Navigation                      │  │
│  │   • Active Partner Session Stamp: "Aditya" or "Anshuman"         │  │
│  │   • Top Bar Contract (Tracker | Calculator | Audit Logs | Exit)  │  │
│  └──────────┬────────────────────┬────────────────────┬─────────────┘  │
│             │                    │                    │                │
│             ▼                    ▼                    ▼                │
│     ┌───────────────┐    ┌───────────────┐    ┌───────────────┐        │
│     │ ProfitTracker │    │   Product     │    │   AuditLog    │        │
│     │ (Rankings,    │    │  Calculator   │    │ (Actor, Time, │        │
│     │  Sales, CSV)  │    │ (Freeform Pr) │    │  Action Diff) │        │
│     └───────┬───────┘    └───────┬───────┘    └───────┬───────┘        │
└─────────────┼────────────────────┼────────────────────┼────────────────┘
              │                    │                    │
              ▼                    ▼                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE & SYNC SERVICE                          │
│                                                                        │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │      Server Express API      │    │     Firestore Real-Time      │  │
│  │   • /api/calculator/products │    │   • calculator_products      │  │
│  │   • /api/calculator/audit    │    │   • calculator_audit_logs    │  │
│  │   • Server JSON disk storage │    │   • onSnapshot live sync     │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Models

```typescript
// Active Partner Session
export interface PartnerSession {
  username: 'Aditya' | 'Anshuman';
  authenticatedAt: string;
  token: string;
}

// Product Entity with Flexible Pricing & Custom Fields
export interface CalculatedProduct {
  id: string;
  name: string;
  category: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: 'Aditya' | 'Anshuman';

  // 3D Print Parameters
  filamentType: string;
  filamentWeightGrams: number;
  filamentCostPerKg: number;
  printTimeHours: number;
  printerWattage: number;
  electricityRatePerKwh: number;
  machineDepreciationPerHour: number;
  failureRatePercent: number;

  // Labor & Finishing
  laborHours: number;
  laborRatePerHour: number;
  postProcessingCost: number;
  packagingCost: number;
  shippingCost: number;
  platformFeePercent: number;
  taxPercent: number;

  // Flexible Selling Price & Volume
  sellingPrice: number; // Any positive integer or decimal
  customFields: CustomCostField[];
  unitsSold: number;
  targetMonthlySales: number;

  // Computed Economics
  materialCost: number;
  electricityCost: number;
  machineCost: number;
  laborCost: number;
  customCostsTotal: number;
  totalCostPerUnit: number;
  profitPerUnit: number;
  profitMarginPercent: number;
  totalRevenue: number;
  totalProfit: number;
}

// Audit Log Entry
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: 'Aditya' | 'Anshuman';
  action: 'LOGIN' | 'CREATE_PRODUCT' | 'UPDATE_PRODUCT' | 'DELETE_PRODUCT' | 'UPDATE_PRICE' | 'UPDATE_SALES' | 'RESET_CATALOG';
  entityId?: string;
  entityName?: string;
  details: string;
}
```

### Component & State Mapping

1. **`AuthGate.tsx`**:
   - Manages login form state: `username`, `password`, `passcode`, `error`.
   - Validates master password `50CROREBY2035` and matches `Aditya` (`3078`) or `Anshuman` (`7985`).
   - Dispatches `LOGIN` audit log and saves encrypted session state to `sessionStorage`.
2. **`ProductCalculator.tsx`**:
   - Updates `sellingPrice` input to `step="any"` and removes browser blocking validation.
   - Adds custom fields editor with real-time recalculation of custom additions.
   - Logs product save/update to audit log with active partner signature.
3. **`ProductProfitTracker.tsx`**:
   - Displays KPIs, rankings, search/filtering, and CSV export.
   - Adds inline quick-edit for `sellingPrice` and `unitsSold` directly in the table row with instant sync.
4. **`AuditLogViewer.tsx`**:
   - Filterable table showing recent actions, partner badge, action tag, and diff details.
5. **`server.ts` & `src/api/routes.ts`**:
   - Exposes `/api/calculator/products` (GET, POST, PUT, DELETE) and `/api/calculator/audit-logs` (GET, POST).
   - Writes to server files `data/calculator_products.json` and `data/calculator_audit_logs.json`.
6. **`src/lib/calculatorFirestore.ts`**:
   - Firestore collection handlers with `onSnapshot` subscriptions and fallback to Express API endpoints.
