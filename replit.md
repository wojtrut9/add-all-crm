# Add All HoReCa CRM

## Overview
A comprehensive business CRM application for a HoReCa distribution company. Built with React (Vite) + Express + PostgreSQL. Entire UI is in Polish language.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + Shadcn UI + Recharts
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Auth**: JWT + bcryptjs (custom, not Replit Auth)
- **Routing**: Wouter (frontend), Express (backend)

## User Accounts (seeded)
| Username | Password | Role | Name |
|----------|----------|------|------|
| admin | admin123 | admin | Administrator |
| gosia | gosia123 | handlowiec | Gosia |
| magda | magda123 | handlowiec | Magda |
| logistyka | logi123 | logistyka | Logistyka |

## Role-Based Access
- **admin**: Full access to all modules (dashboard, clients, calendar, deliveries, drivers, sales analysis, sales dashboard, plan, daily analysis, finance, notes)
- **handlowiec** (Gosia/Magda): Dashboard, their clients, calendar, my sales, notes
- **logistyka**: Dashboard, deliveries, drivers/vehicles

## Key Features
1. **JWT Authentication** - Login with bcrypt password hashing, 7-day token expiry
2. **Client Management** - CRUD, CSV import with field parsing, filters by opiekun/segment/grupa, braki_zamowien alerts
3. **Contact Calendar** - Weekly kanban view, auto-generation based on client rhythm patterns, status tracking (Do zrobienia -> Zamowil/Nie zamowil)
4. **Deliveries** - Daily table view, auto-created when contact status = "Zamowil", driver/vehicle assignment, export to CSV
5. **Sales Analysis** - Charts (pie, bar) by client groups, monthly breakdown with margins
6. **Sales Dashboard** - Plan vs execution for 2026, historical trends (2021-2025)
7. **Finance Panel** - Salaries, operational costs, fleet costs with pie chart breakdowns, month filtering, CRUD for costs with categories
8. **Daily Analysis** - Daily sales tracking with KPI cards (fixed costs, daily cost, break-even), editable daily table with auto-calculations (margin 35.4%), cumulative P&L, month summary, auto-import from contacts
9. **Notes** - Create/filter notes by category
10. **Drivers/Vehicles** - CRUD management

## Database Schema (14 tables)
users, clients, contacts, deliveries, drivers, vehicles, client_sales, client_sales_weekly, sales_targets, salaries, costs, fleet, notes, sales_history, daily_analysis

## Key Business Logic
- Contact generation uses client `rytmKontaktu` (1x/tydz, 2x/mies, etc.) and `dniZamowien` (day preferences)
- When contact status = "Zamowil" with kwota > 0, delivery auto-created for next business day
- When status = "Nie zamowil", client's `brakiZamowien` counter increments
- Clients with brakiZamowien >= 2 get "Pilny" priority on generated contacts

## File Structure
- `shared/schema.ts` - All Drizzle table definitions
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - Database operations (IStorage interface)
- `server/auth.ts` - JWT/bcrypt auth utilities
- `server/seed.ts` - Initial data seeding
- `client/src/App.tsx` - Main app with routing and layout
- `client/src/lib/auth.tsx` - Auth context and fetch helpers
- `client/src/pages/*` - All page components
- `client/src/components/app-sidebar.tsx` - Role-based navigation
