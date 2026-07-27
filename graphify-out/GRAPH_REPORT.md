# Graph Report - .  (2026-07-27)

## Corpus Check
- 134 files · ~205,386 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1237 nodes · 2193 edges · 201 communities (80 shown, 121 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.83)
- Token cost: 0 input · 494,317 output

## Community Hubs (Navigation)
- Frontend API Client
- Docker Compose Services
- Editor & Chart Dependencies
- Backend SQLAlchemy Models
- Chart Config Schemas
- User Auth Routes
- App Shell & Sidebar
- Malloy Connection Manager
- File Storage Backends
- Connection Handler & Encryption
- Dashboard Routes & Validation
- Query Builder Serialization
- TypeScript Config
- Malloy AST Query Builder
- Line Chart Component
- Card & Info Sidebar UI
- Filter Edit Dialog
- Query API Endpoints
- Alert & Spinner UI
- Query Builder UI Component
- Semantic Model Routes
- Dashboard Widget Chart
- Pie Chart Component
- Text Input & Users Page
- Query CRUD Routes
- Button & Dialog UI
- Bar Chart Component
- Treemap Chart Component
- Metric Card & Dashboards Page
- Query Result Extraction
- Package Routes
- Malloy Data Source Connectors
- Card Chart Component
- Dashboard Filter Widget
- File Routes
- Field Tree UI
- Waterfall Chart Component
- Dashboard Workspace Layout
- Landing Page UI
- Queries List Screenshot
- Semantic Model Schemas
- User Schemas
- Detail Row & Queries Page
- Widget Container Component
- Files Page UI
- Package Editor Screenshot
- Connection Schemas
- Query Schemas
- Build & Test Tooling
- Files Page Screenshot
- Semantic Model API Docs
- Table Chart Component
- Dashboard Screenshot
- Users Page Screenshot
- Dashboard Schemas
- Icon Sprite Symbols
- Filter Dialog Screenshot
- Query Builder Screenshot
- File Schemas
- Package Schemas
- Toggle Buttons UI
- Query Builder Sort Types
- Account Schemas
- Connections API Docs
- Table UI Component
- Connection Form Schemas
- Project Structure Docs
- Malloy Query Engine
- Dashboards API Docs
- Packages API Docs
- Dev vs Prod Proxy
- Hero Image Branding
- Select Input UI
- Chester BI Logo
- Autoprefixer Dependency
- Bcrypt Password Hashing
- S3 Storage Dependency
- Credential Encryption Dependency
- FastAPI Dependency
- JWT Auth Dependency
- Redis Dependency
- SQLAlchemy Dependency
- Uvicorn Dependency
- Login Endpoint
- Register Endpoint
- Add Semantic Model Endpoint
- Create File Endpoint
- Create Package Endpoint
- Save Semantic Model Endpoint
- Create Connection Endpoint
- Get Connection Endpoint
- Create Dashboard Endpoint
- Update Dashboard Endpoint
- API Reference Docs
- List Files Endpoint
- Validation Error Schema
- Create User Endpoint
- List Users Endpoint
- Update User Endpoint
- ESLint Dependency
- ESLint JS Config
- React Hooks Lint Plugin
- React Refresh Lint Plugin
- Storybook Lint Plugin
- SPA Entry Document
- ESLint Globals Package
- Jest Test Framework
- Playwright Test Framework
- PostCSS Dependency
- Storybook Dependency
- Storybook A11y Addon
- Storybook Docs Addon
- Storybook Onboarding Addon
- Storybook Vitest Addon
- Storybook React-Vite Addon
- Tailwind CSS Dependency
- Tailwind PostCSS Plugin
- ts-jest Dependency
- Jest Type Definitions
- React Type Definitions
- React DOM Type Definitions
- Vite React Plugin
- Vitest Browser Playwright
- Vitest Coverage Tool
- Favicon Logomark
- Code Style Guidelines
- Vite React Plugin Variants
- React Logo Asset
- aiofiles Dependency
- Email Validator Dependency
- Postgres Driver Dependency
- Argon2 Password Hashing
- Pydantic Dependency
- Dotenv Dependency
- Multipart Upload Dependency
- Requests HTTP Library
- Starlette Dependency
- Set Password Endpoint
- Delete Connection Endpoint
- Test Connection Endpoint
- Delete Dashboard Endpoint
- Load Dashboard Endpoint
- Delete File Endpoint
- List Package Files Endpoint
- List Package Models Endpoint
- Load Package Endpoint
- Delete Query Endpoint
- Delete Semantic Model Endpoint
- Semantic Model File Content Endpoint
- Query Semantic Model Endpoint
- User Permissions Schema
- Delete User Endpoint
- Arrow Left Icon
- Arrow Right Icon
- Chart Icon Mapping
- Check Circle Icon
- Chester BI Icon
- Close Icon Mapping
- Connection Icon Mapping
- Dashboard Icon Mapping
- Edit Icon Mapping
- File Icon Mapping
- Home Icon Mapping
- Load Icon Mapping
- Logout Icon Mapping
- Mail Icon Mapping
- Moon Icon Mapping
- Package Icon Mapping
- Password Icon Mapping
- Query Icon Mapping
- Run Icon Mapping
- Save Icon Mapping
- Search Icon Mapping
- Shield Icon Mapping
- Sort Icon Mapping
- Sun Icon Mapping
- Table Icon Mapping
- User Icon Mapping
- Users Icon Mapping
- React Compiler Note
- Vite Logo Asset
- Chester BI Project
- Contributing Guidelines
- ECharts Library
- Environment Variables Reference
- MIT License
- PostgreSQL Database
- React Library
- React Grid Layout
- React Router
- Tailwind CSS
- TypeScript Language

## God Nodes (most connected - your core abstractions)
1. `User` - 56 edges
2. `check_permissions()` - 47 edges
3. `authHeaders()` - 36 edges
4. `handleResponse()` - 36 edges
5. `Malloy` - 30 edges
6. `QueryPage()` - 20 edges
7. `MalloyASTQueryBuilder` - 18 edges
8. `CButton()` - 17 edges
9. `getRowFieldValue()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Docker Compose Quick Start (5 containers)` --references--> `frontend service (chester_frontend)`  [INFERRED]
  README.md → docker-compose.yml
- `Docker Compose Quick Start (5 containers)` --references--> `postgres service (chester_postgres)`  [INFERRED]
  README.md → docker-compose.yml
- `Modeling (release category)` --references--> `Modeling (roadmap category)`  [EXTRACTED]
  .github/release.yaml → ROADMAP.md
- `Malloy (semantic query language)` --shares_data_with--> `malloy==2024.1096`  [INFERRED]
  README.md → backend/requirements.txt
- `FastAPI` --shares_data_with--> `fastapi==0.136.3`  [INFERRED]
  README.md → backend/requirements.txt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Chester BI Full-Stack Docker Deployment** — docker_compose_frontend, docker_compose_backend, docker_compose_postgres, docker_compose_redis, docker_compose_publisher [EXTRACTED 1.00]
- **Shared Release/Roadmap Category Taxonomy** — github_release_changelog, roadmap_connectivity, roadmap_modeling, roadmap_visualization, roadmap_distribution, roadmap_governance [EXTRACTED 1.00]
- **Backend Authentication & Security Stack** — backend_requirements_pyjwt, backend_requirements_bcrypt, backend_requirements_pwdlib, backend_requirements_cryptography [EXTRACTED 1.00]

## Communities (201 total, 121 thin omitted)

### Community 0 - "Frontend API Client"
Cohesion: 0.06
Nodes (66): addSemanticModel(), authHeaders(), ConnectionCreate, ConnectionDetailedResponse, ConnectionPublicResponse, ConnectionUpdate, createConnection(), createDashboard() (+58 more)

### Community 1 - "Docker Compose Services"
Cohesion: 0.06
Nodes (48): backend service (chester_backend), publisher service (dev compose), redis service (dev compose), frontend service (chester_frontend), postgres service (chester_postgres), publisher service (chester_publisher, internal only), redis service (chester_redis), Release Changelog Configuration (+40 more)

### Community 2 - "Editor & Chart Dependencies"
Cohesion: 0.04
Nodes (46): codemirror, @codemirror/lang-json, @codemirror/lang-sql, @codemirror/theme-one-dark, echarts, echarts-for-react, dependencies, codemirror (+38 more)

### Community 3 - "Backend SQLAlchemy Models"
Cohesion: 0.12
Nodes (20): Account, Base, Dashboard, Base, File, Base, validates, Package (+12 more)

### Community 4 - "Chart Config Schemas"
Cohesion: 0.09
Nodes (30): BarChartSchema, CardSchema, LineChartSchema, PieChartSchema, TableChartSchema, TreemapChartSchema, WaterFallChartSchema, buildDefaultCardConfig() (+22 more)

### Community 5 - "User Auth Routes"
Cohesion: 0.10
Nodes (26): login_for_access_token(), post, put, Session, set_password(), delete_user(), get_users(), delete (+18 more)

### Community 6 - "App Shell & Sidebar"
Cohesion: 0.11
Nodes (19): App(), CSiderBar(), NavItem, navItems, AppLayout(), clearToken(), isAuthenticated(), setToken() (+11 more)

### Community 7 - "Malloy Connection Manager"
Cohesion: 0.07
Nodes (4): MalloyConnection, MalloyModel, MalloyPackage, parse_source_infos()

### Community 8 - "File Storage Backends"
Cohesion: 0.11
Nodes (9): ABC, BaseStorage, get_storage_provider(), LocalStorage, Uploads a file and returns its public path or URL string, Deletes a file from storage, Gets a file from storage, Rollbacks a file from storage (+1 more)

### Community 9 - "Connection Handler & Encryption"
Cohesion: 0.17
Nodes (18): Connection, Base, ConnectionHandler, create_connection(), delete_connection(), get_connection(), list_connections(), delete (+10 more)

### Community 10 - "Dashboard Routes & Validation"
Cohesion: 0.21
Nodes (20): Any, Base, validates, User, create_dashboard(), delete_dashboard(), get_dashboard(), get_dashboard_config() (+12 more)

### Community 11 - "Query Builder Serialization"
Cohesion: 0.13
Nodes (17): QueryCreate, QueryDetailedResponse, buildGroupByFields(), buildOrderByFields(), Granularity, isRuleGroupType(), mergeFilterQuery(), partitionFilterQuery() (+9 more)

### Community 12 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 13 - "Malloy AST Query Builder"
Cohesion: 0.16
Nodes (5): MalloyASTQueryBuilder, extractColumns(), parseGroupByEntry(), QueryPage(), toCalcFieldInfo()

### Community 14 - "Line Chart Component"
Cohesion: 0.19
Nodes (18): DEFAULT_SERIES_COLORS, formatYAxisValue(), getThemeColor(), isTruthy(), LineChart(), LineChartProps, parseList(), readCategoryLabel() (+10 more)

### Community 15 - "Card & Info Sidebar UI"
Cohesion: 0.13
Nodes (12): badgeStyles, CHCard(), CHCardProps, CInfoSideBarProps, CONNECTION_TYPES, ConnectionsPage(), getInitials(), SidebarMode (+4 more)

### Community 16 - "Filter Edit Dialog"
Cohesion: 0.12
Nodes (18): DATETIME_OPS, FilterEditDialogProps, FilterMapping, inputStyle, isCompatible(), KIND_OPTIONS, MultiModelPicker(), MultiModelPickerProps (+10 more)

### Community 17 - "Query API Endpoints"
Cohesion: 0.11
Nodes (19): POST /api/v1/queries/create, GET /api/v1/queries/get, GET /api/v1/queries/list, PUT /api/v1/queries/update, QueryCreateRequest schema, QueryDetailedResponse schema, QueryPackage schema, QueryPublicResponse schema (+11 more)

### Community 18 - "Alert & Spinner UI"
Cohesion: 0.14
Nodes (13): AlertVariant, CAlert(), CAlertProps, styles, CSpinner(), CSpinnerProps, breakpoints, cols (+5 more)

### Community 19 - "Query Builder UI Component"
Cohesion: 0.14
Nodes (16): booleanOperators, countFilterRules(), CQueryBuilder(), CQueryBuilderProps, defaultOperators, EMPTY_FILTER_QUERY, isBoolean(), isDateTime() (+8 more)

### Community 20 - "Semantic Model Routes"
Cohesion: 0.24
Nodes (16): add_semantic_model(), delete_semantic_model(), get_compiled_model(), get_file_content(), delete, get, post, put (+8 more)

### Community 21 - "Dashboard Widget Chart"
Cohesion: 0.23
Nodes (15): DashboardWidgetChart(), DashboardWidgetChartProps, isConfigTruthy(), renderWidgetChart(), FilterRule, DashboardElementMeta, fetchWidgetQueryData(), readNumericFromRows() (+7 more)

### Community 22 - "Pie Chart Component"
Cohesion: 0.21
Nodes (16): buildSideLegendFormatter(), buildSliceLabel(), buildTooltipFormatter(), DEFAULT_SLICE_COLORS, formatPieRadius(), getThemeColor(), isTruthy(), parseList() (+8 more)

### Community 23 - "Text Input & Users Page"
Cohesion: 0.15
Nodes (6): CTextInputProps, getInitials(), PERMISSION_GROUPS, PermissionPickerProps, SidebarMode, UsersPage()

### Community 24 - "Query CRUD Routes"
Cohesion: 0.28
Nodes (12): create_query(), delete_query(), get_query(), list_queries(), delete, get, post, put (+4 more)

### Community 25 - "Button & Dialog UI"
Cohesion: 0.18
Nodes (8): ButtonVariant, CButton(), CButtonProps, variantStyles, CConfirmDialogProps, ConfirmVariant, variantIcon, CDialogProps

### Community 26 - "Bar Chart Component"
Cohesion: 0.24
Nodes (12): BarChart(), BarChartProps, getThemeColor(), isDarkMode(), isTruthy(), parseList(), readCategoryLabel(), readNumericValue() (+4 more)

### Community 27 - "Treemap Chart Component"
Cohesion: 0.24
Nodes (12): getThemeColor(), isDarkMode(), isTruthy(), parseList(), readCategoryLabel(), readNumericValue(), TILE_COLORS_DARK, TILE_COLORS_LIGHT (+4 more)

### Community 28 - "Metric Card & Dashboards Page"
Cohesion: 0.21
Nodes (7): CMetricCard(), CMetricCardProps, DashboardsPage(), getDashboardInitials(), isThisMonth(), isToday(), SidebarMode

### Community 29 - "Query Result Extraction"
Cohesion: 0.28
Nodes (12): extractRows(), buildFieldCandidates(), extractArrayRows(), findRowKey(), getRowFieldValue(), isPlainRow(), normalizeQueryRows(), parseMalloyCompact() (+4 more)

### Community 30 - "Package Routes"
Cohesion: 0.45
Nodes (11): create_package(), get_package(), list_files(), list_models(), list_packages(), load_package(), get, post (+3 more)

### Community 32 - "Card Chart Component"
Cohesion: 0.20
Nodes (10): CardChart(), CardChartProps, DataField, fmt(), Default, meta, SmallWidget, Story (+2 more)

### Community 33 - "Dashboard Filter Widget"
Cohesion: 0.21
Nodes (9): DashboardFilterWidget(), DashboardFilterWidgetProps, DATE_UNITS, iSty, AvailableChart, FilterEditDialog(), FilterKind, NO_VALUE_OPS (+1 more)

### Community 34 - "File Routes"
Cohesion: 0.25
Nodes (9): create_file(), delete_file(), list_files(), delete, get, post, Session, UploadFile (+1 more)

### Community 35 - "Field Tree UI"
Cohesion: 0.29
Nodes (9): CFieldTree(), CFieldTreeProps, FieldGroup, FieldIcon(), Granularity, isDateTime(), SortDir, SortItem (+1 more)

### Community 36 - "Waterfall Chart Component"
Cohesion: 0.31
Nodes (10): computeWaterfallSeries(), getThemeColor(), isTruthy(), parseList(), readCategoryLabel(), readNumericValue(), TitleField, useContainerSize() (+2 more)

### Community 37 - "Dashboard Workspace Layout"
Cohesion: 0.27
Nodes (10): DashboardElement, toSavedWidgetMeta(), breakpoints, buildLayouts(), cols, DashboardWorkSpace(), getNextY(), getSquareGridMetrics() (+2 more)

### Community 38 - "Landing Page UI"
Cohesion: 0.22
Nodes (5): features, fmtStars(), LandingPage(), steps, useGitHubStars()

### Community 39 - "Queries List Screenshot"
Cohesion: 0.24
Nodes (10): Chester BI Application, ecommerce Model, ecommerce_orders Source Table, New Query Action Button, Chester BI Queries List Screenshot, Queries Page (create/manage data queries), Queries Table (Name, Package, Model, Source, Created At, Created By), Query Stats Cards (Total, Created This Month, Updated Today, Models Used) (+2 more)

### Community 40 - "Semantic Model Schemas"
Cohesion: 0.33
Nodes (9): Config, BaseModel, SchemaContainer, SemanticModelBase, SemanticModelField, SemanticModelFieldType, SemanticModelPublicResponse, SemanticModelSchema (+1 more)

### Community 41 - "User Schemas"
Cohesion: 0.31
Nodes (9): Config, BaseModel, UserAdminResponse, UserBase, UserCreate, UserPermissions, UserPublicResponse, UserUpdate (+1 more)

### Community 42 - "Detail Row & Queries Page"
Cohesion: 0.27
Nodes (5): columns, formatDate(), isThisMonth(), isToday(), QueriesPage()

### Community 43 - "Widget Container Component"
Cohesion: 0.24
Nodes (7): CWidgetProps, Default, meta, Story, WidgetChartConfig, WidgetSaveResult, QueryPublicResponse

### Community 44 - "Files Page UI"
Cohesion: 0.29
Nodes (7): columns, FilesPage(), formatDate(), formatFileSize(), isThisMonth(), isToday(), SidebarMode

### Community 45 - "Package Editor Screenshot"
Cohesion: 0.28
Nodes (9): Chester BI Application, DuckDB (data source), ecommerce.malloy file, ecommerce_orders source (dimension definitions), Malloy modeling language, Package Editor UI (Chester BI), Packages navigation section, publisher.json file (+1 more)

### Community 46 - "Connection Schemas"
Cohesion: 0.36
Nodes (8): Config, ConnectionBase, ConnectionCreate, ConnectionDetailedResponse, ConnectionPublicResponse, ConnectionTestResponse, ConnectionUpdate, BaseModel

### Community 47 - "Query Schemas"
Cohesion: 0.39
Nodes (8): Config, BaseModel, QueryBase, QueryCreateRequest, QueryDetailedResponse, QueryPackage, QueryPublicResponse, QuerySemanticModel

### Community 48 - "Build & Test Tooling"
Cohesion: 0.22
Nodes (9): @chromatic-com/storybook, devDependencies, @chromatic-com/storybook, typescript, vite, vitest, typescript, vite (+1 more)

### Community 49 - "Files Page Screenshot"
Cohesion: 0.36
Nodes (8): Chester BI Application, Light/Dark Mode Toggle Control, ecommerce_orders_dataset.csv File Entry, Files List Table (Name, File Name, Extension, Size), Files Page Screenshot, Sidebar Navigation Menu (Home, Dashboards, Queries, Files, Connections, Packages, Users), Files Stats Summary Cards (Total, Created This Month, Updated Today), Upload File Side Panel Dialog (Name, Description, File fields)

### Community 50 - "Semantic Model API Docs"
Cohesion: 0.25
Nodes (8): SchemaContainer schema, SemanticModelField schema, SemanticModelFieldType schema, SemanticModelSchema schema, SemanticModelSource schema, GET /api/v1/semantic-models/get-compiled-model, dimension icon (IoText), measure icon (TbRulerMeasure2)

### Community 51 - "Table Chart Component"
Cohesion: 0.36
Nodes (7): formatCell(), isTruthy(), parseList(), SortDir, TableChart(), TableChartProps, TitleField

### Community 52 - "Dashboard Screenshot"
Cohesion: 0.43
Nodes (7): Daily Metrics Data Table (sortable columns, paginated 1000 rows), order_date Range Filter (Last N years, Apply, chart count badge), KPI Metric Cards (Today Revenue, Total Orders w/ target progress, Net Profit, Total Customers), Monthly Growth Line Chart, Monthly Revenue Area Chart, Revenue by Country % Donut Chart (paginated legend, 10 countries), Sales Overview Dashboard Screenshot

### Community 53 - "Users Page Screenshot"
Cohesion: 0.38
Nodes (7): Edit User Slide-over Dialog, Role-Based Permissions Matrix (Dashboards/Users/Connections/Models/Packages), Chester BI Sidebar Navigation (Home, Dashboards, Queries, Files, Connections, Packages, Users), Light/Dark Mode Toggle, Users Stat Cards (Total/Active/Inactive), Chester BI Users Management Screenshot, Chester BI Application

### Community 54 - "Dashboard Schemas"
Cohesion: 0.43
Nodes (6): Config, DashboardBase, DashboardCreate, DashboardPublicResponse, DashboardUpdate, BaseModel

### Community 55 - "Icon Sprite Symbols"
Cohesion: 0.52
Nodes (7): Bluesky Icon Symbol, Discord Icon Symbol, Documentation Icon Symbol, GitHub Icon Symbol, Icons SVG Sprite Sheet, Social/Contacts Icon Symbol, X (Twitter) Icon Symbol

### Community 56 - "Filter Dialog Screenshot"
Cohesion: 0.40
Nodes (6): Configure Filter Dialog (Screenshot), Filter Type Selector (DateTime/Date/Number/Text), Model Field Mapping Panel (Package/Model/Fields), Filter Operator Selector (Equals, Contains, Is Null, etc.), sales-analytics / ecommerce Model (36 compatible fields), Target Charts Selection (scope filter to specific widgets)

### Community 57 - "Query Builder Screenshot"
Cohesion: 0.47
Nodes (6): Dimension Time-Granularity Picker, Query Filters Panel, Malloy Query Language Support, Query Builder UI Screenshot, Query Results Table View, Package/Model Semantic Layer Selector

### Community 58 - "File Schemas"
Cohesion: 0.53
Nodes (5): Config, File, FileCreateRequest, FilePublicResponse, BaseModel

### Community 59 - "Package Schemas"
Cohesion: 0.53
Nodes (5): PackageBase, PackageCreate, PackageResponse, PackageUpdate, BaseModel

### Community 60 - "Toggle Buttons UI"
Cohesion: 0.40
Nodes (5): CToggleButtons(), CToggleButtonsProps, renderIcon(), sizeStyles, ToggleButtonItem

### Community 61 - "Query Builder Sort Types"
Cohesion: 0.33
Nodes (5): CalculateItem, isRule(), query, SortDir, SortItem

### Community 62 - "Account Schemas"
Cohesion: 0.60
Nodes (4): AccountBase, AccountPublicResponse, OwnerCreate, BaseModel

### Community 63 - "Connections API Docs"
Cohesion: 0.50
Nodes (4): ConnectionPublicResponse schema, ConnectionUpdate schema, GET /api/v1/connections/list, PUT /api/v1/connections/update

### Community 64 - "Table UI Component"
Cohesion: 0.67
Nodes (3): CTable(), CTableProps, formatCell()

### Community 65 - "Connection Form Schemas"
Cohesion: 0.50
Nodes (3): BigQuerySchema, PostgresMySqlSchema, SnowflakeSchema

### Community 66 - "Project Structure Docs"
Cohesion: 0.67
Nodes (3): backend/requirements.txt (manifest), docker-compose.yml (orchestration), Project Structure

### Community 67 - "Malloy Query Engine"
Cohesion: 0.67
Nodes (3): malloy==2024.1096, Malloy (semantic query language), Malloy Publisher (query engine)

### Community 68 - "Dashboards API Docs"
Cohesion: 0.67
Nodes (3): DashboardPublicResponse schema, GET /api/v1/dashboards/get, GET /api/v1/dashboards/list

### Community 69 - "Packages API Docs"
Cohesion: 0.67
Nodes (3): PackageResponse schema, GET /api/v1/packages/get, GET /api/v1/packages/list

### Community 70 - "Dev vs Prod Proxy"
Cohesion: 0.67
Nodes (3): React + Vite template, Nginx (production reverse proxy), Vite dev server / proxy

### Community 71 - "Hero Image Branding"
Cohesion: 0.67
Nodes (3): Purple Brand Gradient Motif, Hero Image, Landing / Marketing Page

## Ambiguous Edges - Review These
- `Documentation Icon Symbol` → `Social/Contacts Icon Symbol`  [AMBIGUOUS]
  frontend/public/icons.svg · relation: conceptually_related_to

## Knowledge Gaps
- **384 isolated node(s):** `Config`, `Config`, `Config`, `name`, `private` (+379 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **121 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Documentation Icon Symbol` and `Social/Contacts Icon Symbol`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `User` connect `Dashboard Routes & Validation` to `File Routes`, `Backend SQLAlchemy Models`, `User Auth Routes`, `Connection Handler & Encryption`, `Semantic Model Routes`, `Query CRUD Routes`, `Package Routes`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `Malloy` connect `Malloy Data Source Connectors` to `Backend SQLAlchemy Models`, `Malloy Connection Manager`, `Connection Handler & Encryption`, `Semantic Model Routes`, `Package Routes`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `MalloyASTQueryBuilder` connect `Malloy AST Query Builder` to `Query Builder Serialization`, `Query Builder Sort Types`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `Config`, `Config`, `Config` to the rest of the system?**
  _384 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.05955734406438632 - nodes in this community are weakly interconnected._
- **Should `Docker Compose Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05585106382978723 - nodes in this community are weakly interconnected._