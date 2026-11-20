# LAI Web layout and pages

`router/routes.tsx` is the single route and menu configuration. Each route declares its `path`, `component`, `name`, `icon`, `order`, optional `group`, `placement` and `hideInMenu`. Navigation, breadcrumbs and page headings derive from those records. A hidden menu route can still render by its path. Hash URLs keep direct links compatible with the existing DSH static host without requiring server rewrite rules.

- `AppLayout`: top bar, navigation, authentication gate and main region.
- `PageLayout`: shared page width, gutters, scrolling and workspace sizing.
- `PageHeader`: one title style, help and page actions, always outside panels.
- `PagePanel`: content card and section-heading styling.
- `PageTabs`: shared tab appearance and ARIA relationships.
- `RefreshAction`: shared refresh icon and busy state.
- `pages/`: business data, forms, actions and content. Shared Run loading lives in `components/RunDetailLoader.tsx`; pages do not import other pages.

To add a page, implement it under `pages/`, add its ID and route record in `router/routes.tsx`, and use `PageHeader` and content panels. Do not add separate navigation items, title maps, App conditionals or page-specific outer padding/cards. Business-specific layouts such as the Runs split view remain inside the common page layout.
