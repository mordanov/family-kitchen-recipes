# Graph Report - .  (2026-05-21)

## Corpus Check
- Corpus is ~31,399 words - fits in a single context window. You may not need a graph.

## Summary
- 561 nodes · 1365 edges · 38 communities (31 shown, 7 thin omitted)
- Extraction: 71% EXTRACTED · 29% INFERRED · 0% AMBIGUOUS · INFERRED: 394 edges (avg confidence: 0.7)
- Token cost: 350 input · 280 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Recipe & Cooking Directories API|Recipe & Cooking Directories API]]
- [[_COMMUNITY_Menu Models & Schemas|Menu Models & Schemas]]
- [[_COMMUNITY_Shopping List & Synonym Engine|Shopping List & Synonym Engine]]
- [[_COMMUNITY_Auth & Settings API|Auth & Settings API]]
- [[_COMMUNITY_Menu Management Logic|Menu Management Logic]]
- [[_COMMUNITY_Frontend Test Suite|Frontend Test Suite]]
- [[_COMMUNITY_Core React App Shell|Core React App Shell]]
- [[_COMMUNITY_Frontend Package Config|Frontend Package Config]]
- [[_COMMUNITY_Recipe UI Components|Recipe UI Components]]
- [[_COMMUNITY_Family Members API|Family Members API]]
- [[_COMMUNITY_Project Architecture Overview|Project Architecture Overview]]
- [[_COMMUNITY_Settings & Members UI|Settings & Members UI]]
- [[_COMMUNITY_Warehouse UI|Warehouse UI]]
- [[_COMMUNITY_Frontend API Client|Frontend API Client]]
- [[_COMMUNITY_History & Menu Status|History & Menu Status]]
- [[_COMMUNITY_Frontend Express Server|Frontend Express Server]]
- [[_COMMUNITY_Menu UI Components|Menu UI Components]]
- [[_COMMUNITY_Initial DB Migrations|Initial DB Migrations]]
- [[_COMMUNITY_Cooking Methods Migrations|Cooking Methods Migrations]]
- [[_COMMUNITY_Directories & Drafts Migrations|Directories & Drafts Migrations]]
- [[_COMMUNITY_KBJU Nutrition Service|KBJU Nutrition Service]]
- [[_COMMUNITY_Member & Menu Slot Migrations|Member & Menu Slot Migrations]]
- [[_COMMUNITY_Recipe Categories & Timing|Recipe Categories & Timing]]
- [[_COMMUNITY_Recipe Extra Fields Migrations|Recipe Extra Fields Migrations]]
- [[_COMMUNITY_Warehouse & Members Foundation|Warehouse & Members Foundation]]
- [[_COMMUNITY_KBJU Tests|KBJU Tests]]
- [[_COMMUNITY_Alembic Migration Config|Alembic Migration Config]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Color Utility|Color Utility]]

## God Nodes (most connected - your core abstractions)
1. `select` - 62 edges
2. `MenuStatus` - 47 edges
3. `Gender` - 47 edges
4. `DietModel` - 47 edges
5. `Recipe` - 34 edges
6. `get_shopping_list()` - 29 edges
7. `MenuItem` - 24 edges
8. `api` - 19 edges
9. `Base` - 18 edges
10. `update_recipe()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `WarehousePage()` --shares_data_with--> `StockItem`  [INFERRED]
  frontend/src/pages/WarehousePage.jsx → backend/app/models.py
- `WarehousePage()` --shares_data_with--> `PreparedDish`  [INFERRED]
  frontend/src/pages/WarehousePage.jsx → backend/app/models.py
- `WarehousePage()` --shares_data_with--> `ReceiptDraft`  [INFERRED]
  frontend/src/pages/WarehousePage.jsx → backend/app/models.py
- `MembersPage()` --shares_data_with--> `FamilyMember`  [INFERRED]
  frontend/src/pages/MembersPage.jsx → backend/app/models.py
- `buildKbjuMatrix()` --shares_data_with--> `MenuKbjuSummary`  [INFERRED]
  frontend/src/pages/HistoryPage.jsx → backend/app/schemas.py

## Hyperedges (group relationships)
- **API Token Authentication Flow** — src_api_gettoken, src_api_request, src_api_handleresponse [EXTRACTED 1.00]
- **Frontend SPA Page Routing** — src_app_app, pages_recipespage_recipespage, pages_menupage_menupage, pages_shoppingpage_shoppingpage [EXTRACTED 1.00]
- **Frontend Test Infrastructure** — tests_setup_setup, tests_helpers_renderreact, frontend_vitest_config [EXTRACTED 1.00]
- **Warehouse Data Flow: Stock, PreparedDish, ReceiptDraft managed by WarehousePage** — pages_warehousepage_warehousepage, app_models_stockitem, app_models_prepareddish, app_models_receiptdraft [INFERRED 0.95]
- **Recipe Member Feedback: FamilyMember preferences displayed via RecipeMemberFeedback in RecipeCard and RecipeDetailModal** — app_models_familymember, recipes_recipememberfeedback_recipememberfeedback, recipes_recipecard_recipecard, recipes_recipedetailmodal_recipedetailmodal [INFERRED 0.85]
- **Per-member menu slot assignment: MenuItemMember links MenuItem, FamilyMember, Recipe for per-person meal scheduling** — app_models_menuitemmember, app_models_menuitem, app_models_familymember [EXTRACTED 1.00]
- **Receipt Processing Pipeline: upload, vision OCR, synonym normalization, draft creation** — api_warehouse_process_receipt, services_receipt_parser_parse_receipt_with_vision, api_warehouse__apply_synonyms [EXTRACTED 1.00]
- **Synonym Management Shared State across warehouse, menus, and settings APIs** — api_settings_set_product_synonyms, api_menus__merged_synonyms, api_warehouse_process_receipt [INFERRED 0.85]
- **KBJU Background Calculation Flow: recipe save triggers background KBJU calc via OpenAI** — api_recipes_create_recipe, api_recipes_run_kbju_calculation, services_kbju_calculate_kbju [EXTRACTED 1.00]
- **cookingmethod Enum Evolution: initial definition through enum-to-table migration** — versions_0001_initial_upgrade, versions_0002_add_dry_frying_upgrade, versions_0008_add_recipe_categories_and_text_upgrade, versions_0013_add_cooking_methods_sous_vide_sauce_grill_upgrade, versions_0014_alter_cooking_methods_upgrade, versions_0015_recipe_categories_and_cooking_methods_directory_upgrade, versions_0017_drop_cooking_method_column_upgrade [EXTRACTED 1.00]
- **Recipes Table Enrichment: time fields, materials, categories, cooking methods** — versions_0008_add_recipe_categories_and_text_upgrade, versions_0009_add_recipe_cooking_time_upgrade, versions_0010_add_recipe_active_time_and_freezer_upgrade, versions_0011_add_recipe_additional_material_upgrade, versions_0012_add_recipe_additional_material_original_name_upgrade [INFERRED 0.95]
- **Family Members Schema Evolution: creation and refinement** — versions_0005_add_family_members_upgrade, versions_0006_member_birth_date_upgrade, versions_0007_menu_meal_slots_upgrade [INFERRED 0.85]

## Communities (38 total, 7 thin omitted)

### Community 0 - "Recipe & Cooking Directories API"
Cohesion: 0.06
Nodes (65): create_cooking_method(), create_recipe_category(), delete_cooking_method(), delete_recipe_category(), list_cooking_methods(), list_recipe_categories(), CRUD endpoints for editable directories: recipe categories and cooking methods., update_cooking_method() (+57 more)

### Community 1 - "Menu Models & Schemas"
Cohesion: 0.15
Nodes (54): _menu_kbju_summary(), DietModel, Gender, MenuStatus, AutoFillRequest, Config, CookingMethodCreate, CookingMethodOut (+46 more)

### Community 2 - "Shopping List & Synonym Engine"
Cohesion: 0.10
Nodes (51): _extract_product_key, _group_shopping_lines, _line_per_portion, _parse_amount_and_unit, get_shopping_list(), _apply_synonyms, Base, AppSettings (+43 more)

### Community 3 - "Auth & Settings API"
Cohesion: 0.07
Nodes (33): login(), me(), get_phrase_synonyms(), get_product_synonyms(), _get_setting(), get_unresolved_synonyms(), _load_aliases(), Return product names that were seen during receipt processing but have no synony (+25 more)

### Community 4 - "Menu Management Logic"
Cohesion: 0.13
Nodes (33): _menu_to_out, _merged_synonyms, add_menu_item(), _add_to_bucket(), auto_fill_menu(), _canonical_product_token(), close_menu(), create_menu() (+25 more)

### Community 5 - "Frontend Test Suite"
Cohesion: 0.11
Nodes (24): changeValue(), click(), flushMicrotasks(), renderReact(), loadApp(), login, me, shoppingButton (+16 more)

### Community 6 - "Core React App Shell"
Cohesion: 0.13
Nodes (18): MembersPage(), isMealSlotMenu(), MenuPage(), RecipesPage(), ShoppingPage(), App(), NAV_ITEMS, ConfirmOverlay() (+10 more)

### Community 7 - "Frontend Package Config"
Cohesion: 0.09
Nodes (21): dependencies, express, react, react-dom, description, devDependencies, jsdom, vite (+13 more)

### Community 8 - "Recipe UI Components"
Cohesion: 0.22
Nodes (14): RecipeCard(), RecipeDetailModal(), buildRecipeFormData(), createEmptyRecipeForm(), defaultRecipeForm, RecipeFormModal(), RecipeMemberFeedback(), Badge() (+6 more)

### Community 9 - "Family Members API"
Cohesion: 0.21
Nodes (19): _build_out, _save_photo, add_disliked(), add_preferred(), _build_out(), create_member(), delete_member(), get_member() (+11 more)

### Community 10 - "Project Architecture Overview"
Cohesion: 0.32
Nodes (15): backend/requirements.txt, Alembic Database Migrations, CI/CD Pipeline, FastAPI Backend Service, JWT Authentication, OpenAI Macro Calculation Integration, PostgreSQL 16 Database, React 18 Frontend SPA (+7 more)

### Community 11 - "Settings & Members UI"
Cohesion: 0.20
Nodes (11): defaultForm, PRESET_COLORS, Modal(), calcAge(), dietClass(), dietLabel(), genderIcon(), initials() (+3 more)

### Community 12 - "Warehouse UI"
Cohesion: 0.27
Nodes (11): todayIso(), WarehousePage(), pluralItems(), WarehouseDraftModal(), WarehouseDraftsZone(), PreparedModal(), StockModal(), PreparedModal (+3 more)

### Community 13 - "Frontend API Client"
Cohesion: 0.24
Nodes (7): api, download(), getToken(), handleResponse(), request(), pdfBlob, tests/setup.js

### Community 14 - "History & Menu Status"
Cohesion: 0.26
Nodes (8): MenuStatusBanner(), buildKbjuMatrix(), HistoryPage(), ProgressBar(), formatDate(), formatRounded(), kbjuFromRecipe(), weeksLabel()

### Community 15 - "Frontend Express Server"
Cohesion: 0.20
Nodes (9): app, DIST_DIR, express, http, https, path, PORT, proxyToBackend() (+1 more)

### Community 16 - "Menu UI Components"
Cohesion: 0.33
Nodes (7): MenuAddPanel(), MenuFlatRow(), MenuItemsList(), MenuSlotCard(), DAY_LABELS, MEAL_LABELS, MEAL_ORDER

### Community 17 - "Initial DB Migrations"
Cohesion: 0.22
Nodes (3): upgrade(), upgrade(), upgrade()

### Community 18 - "Cooking Methods Migrations"
Cohesion: 0.22
Nodes (3): upgrade(), upgrade(), upgrade()

### Community 19 - "Directories & Drafts Migrations"
Cohesion: 0.25
Nodes (3): upgrade(), upgrade(), upgrade()

### Community 20 - "KBJU Nutrition Service"
Cohesion: 0.29
Nodes (7): _mock_kbju, calculate_kbju(), _mock_kbju(), Mock KBJU when no OpenAI key is set.     Produces plausible values based on ingr, Calculate KBJU using OpenAI API.     Returns dict with calories, proteins, fats,, test_calculate_kbju_extracts_json_from_openai_response, test_calculate_kbju_uses_mock_when_openai_key_is_missing

### Community 25 - "KBJU Tests"
Cohesion: 0.53
Nodes (4): install_fake_openai(), test_calculate_kbju_extracts_json_from_openai_response(), test_calculate_kbju_returns_none_for_suspicious_values(), test_calculate_kbju_uses_recipe_text_when_present()

### Community 27 - "Brand Identity"
Cohesion: 0.50
Nodes (4): Fork and Knife Utensils, Kitchen/Food Branding, Warm Color Palette (Orange #FF6B35, Peach #FFB347), Favicon SVG - Kitchen/Food App Icon

## Ambiguous Edges - Review These
- `login()` → `_get_setting_value`  [AMBIGUOUS]
  backend/app/api/auth.py · relation: semantically_similar_to

## Knowledge Gaps
- **64 isolated node(s):** `express`, `http`, `https`, `path`, `app` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `login()` and `_get_setting_value`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `select` connect `Recipe & Cooking Directories API` to `Shopping List & Synonym Engine`, `Auth & Settings API`, `Menu Management Logic`, `Frontend Test Suite`, `Family Members API`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Why does `WarehousePage()` connect `Warehouse UI` to `Shopping List & Synonym Engine`, `Core React App Shell`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `api` connect `Frontend API Client` to `Core React App Shell`, `Recipe UI Components`, `Settings & Members UI`, `Warehouse UI`, `History & Menu Status`, `Frontend Express Server`, `Menu UI Components`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `select` (e.g. with `get_current_user()` and `seed_directories()`) actually correct?**
  _`select` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Are the 45 inferred relationships involving `MenuStatus` (e.g. with `Base` and `Token`) actually correct?**
  _`MenuStatus` has 45 INFERRED edges - model-reasoned connections that need verification._
- **Are the 45 inferred relationships involving `Gender` (e.g. with `Base` and `Token`) actually correct?**
  _`Gender` has 45 INFERRED edges - model-reasoned connections that need verification._