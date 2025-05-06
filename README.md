# RAG Bot dla Weegree One

Aplikacja RAG (Retrieval-Augmented Generation) umożliwia zadawanie pytań o ofertę i funkcje robotów Weegree One.

## Technologie
- Bun, Node.js 18+
- Express.js (backend)
- Qdrant (wektorowa baza danych)
- OpenAI (embeddings: text-embedding-3-small, chat: GPT-4o-mini)
- React 18 + Vite
- Tailwind CSS (+ @tailwindcss/forms)
- Framer Motion, react-type-animation

## Funkcjonalności

1. **Scraper** (`src/scraper/index.ts`)
   - Pobiera treść witryny w formacie Markdown za pomocą Firecrawl
   - Zapisuje pliki Markdown w `data/markdown` i JSON w `data/scraped-content.json`

2. **Backend** (`src/backend/ragServer.ts`)
   - Ładuje zmienne środowiskowe z `.env`
   - Inicjalizuje kolekcję w Qdrant (Obsługa błędów 403/404/400)
   - Generuje embeddingi przez OpenAI
   - Przeszukuje Qdrant (limit 10, score_threshold 0.65, sortowanie FAQ)
   - Kompiluje kontekst i wysyła zapytanie do GPT-4o-mini z systemowym promptem po polsku
   - Zwraca odpowiedź oraz listę źródeł

3. **Frontend** (`src/frontend`)
   - React + Vite z UI czatu
   - Gradientowe dymki, awatary, lista sugestii pytań
   - Animacje (Framer Motion, react-type-animation)
   - Automatyczne przewijanie, wskaźnik "pisania"
   - Formatowanie źródeł z ikoną `ArrowTopRightOnSquareIcon`

## Struktura projektu
```
.
├── data/                       # Pobrane treści (Markdown + JSON)
├── src/
│   ├── scraper/               # Firecrawl do scrapowania strony
│   ├── backend/               # Express API (RAG Server)
│   └── frontend/              # React + Vite + Tailwind CSS
├── .env.example               # Przykładowe zmienne środowiskowe
├── README.md                  # Ten plik
├── bun.lock                   # Lockfile Bun
├── package.json               # Skrypty i zależności (root)
└── tsconfig.json              # Konfiguracja TypeScript
```

## Wymagania
- Bun
- Docker (do uruchomienia Qdrant) lub zdalny serwer Qdrant
- Klucz OpenAI w `.env`
- Node.js 18+ (opcjonalnie)

## Konfiguracja
1. Sklonuj repozytorium i przejdź do folderu projektu:
   ```bash
   git clone <URL_REPOZYTORIUM>
   cd rag-bot-for-weegree-one-website
   ```
2. Skopiuj i uzupełnij zmienne środowiskowe:
   ```bash
   cp .env.example .env
   ```
3. Zainstaluj zależności (root + frontend):
   ```bash
   bun install
   cd src/frontend && bun install && cd ../../
   ```

## Uruchomienie

1. **Qdrant:**
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```
2. **Scraper:**
   ```bash
   bun run scrape
   ```
3. **Backend (port 3000):**
   ```bash
   bun run dev
   ```
4. **Frontend (port 5173):**
   ```bash
   cd src/frontend
   bun run dev
   ```

Otwórz przeglądarkę:
- Frontend: http://localhost:5173/
- API: http://localhost:3000/ask

## Licencja
ISC 