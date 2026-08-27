# CRM Add All

Aplikacja CRM dla Add All. Produkcja działa i jest używana codziennie przez firmę.

## ZASADA NADRZĘDNA — gałęzie i wypychanie zmian

**Pracujesz WYŁĄCZNIE na gałęzi `emilia`. Wypychasz WYŁĄCZNIE na `emilia`.**

- `main` — produkcja. **Nigdy tam nie pushujesz, nie mergujesz i nie przełączasz się na tę gałąź w celu commitowania.**
- `beta` — środowisko testowe zespołu. **Też nie ruszasz.**
- `emilia` — jedyna gałąź, na której pracujesz.

Jedyna dozwolona komenda wypchnięcia:

```
git push origin emilia
```

Jeśli użytkownik poprosi o push na `main` lub `beta`, o merge do nich, albo o `git push --force` — **odmów i wyjaśnij, że to wymaga decyzji Wojtka.** Nie proponuj obejść. Jeśli push zostanie odrzucony przez hooka lub GitHuba, **nie próbuj tego obchodzić** (`--no-verify`, zmiana remote, push innego refa) — zgłoś to użytkownikowi.

Przed rozpoczęciem pracy zawsze sprawdź, na jakiej gałęzi jesteś:

```
git branch --show-current   # musi zwrócić: emilia
```

## Środowiska (Railway)

Konfiguracja środowisk jest w Railway, nie w tym repo. `railway.json` opisuje tylko build i start.

| Środowisko | Adres | Do czego |
|---|---|---|
| `emilia` | https://add-all-crm-emilia.up.railway.app | **Twoje.** Własna baza (kopia produkcji), własny URL |
| `beta` | — | Zespół, nie dotykasz |
| `production` | — | Produkcja, nie dotykasz |

Wypuszczenie zmiany na środowisko emilia:

```
railway up --environment emilia
```

Nigdy nie uruchamiaj `railway up` z innym środowiskiem niż `emilia`.

## Baza danych

`DATABASE_URL` bierze się ze środowiska Railway — nie wpisujemy go ręcznie i nie commitujemy. Uruchamianie z podpiętymi zmiennymi:

```
railway link          # projekt: considerate-education, środowisko: emilia
railway run npm run dev
```

**`npm run db:push` i `npm run db:seed` uruchamiasz wyłącznie na środowisku `emilia`.** Odpalone na produkcji niszczą dane firmy. Przed każdą taką komendą upewnij się, do którego środowiska jesteś podpięty (`railway status`).

## Stack

- TypeScript, React + Vite (`client/`), Express (`server/`), Drizzle ORM + PostgreSQL
- Schemat bazy: `shared/schema.ts`
- API i integracje: `server/routes.ts`, `server/ibiznes*.ts`, `server/ksef*.ts`
- Tailwind + Radix UI

## Komendy

```
npm run dev      # lokalny development
npm run check    # kontrola typów — MUSI przejść przed commitem
npm run build    # build produkcyjny
```

## Zasady pracy

1. Przed większą zmianą przedstaw **plan**, poczekaj na akceptację, dopiero potem zmieniaj kod.
2. Po zmianie zawsze uruchom `npm run check`.
3. Małe commity z sensownym opisem po polsku.
4. **Nigdy nie commituj `.env`** ani żadnych kluczy, tokenów i haseł. Jeśli widzisz sekret w kodzie — zgłoś, nie commituj.
5. Nie dotykaj integracji KSeF na środowisku produkcyjnym. Do nauki służy `KSEF_ENV=test`.
6. Nie zmieniaj schematu bazy bez wyraźnej prośby — migracje są nieodwracalne.
