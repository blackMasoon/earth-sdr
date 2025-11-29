# WebSDR Atlas – szczegółowy plan implementacji

Webowa aplikacja agregująca wszystkie dostępne WebSDR-y z całego świata, z:

- mapą (OSM) z wyborem SDR-ów,
- listą alternatywną,
- szacowanym zasięgiem dla zakresów częstotliwości (okręgi),
- jednym, płynnie skalowalnym waterfall-em,
- suwakiem częstotliwości (mysz + strzałki),
- zapisanymi „programami” (nazwy + kolory + częstotliwości),
- minimalistycznym, intuicyjnym UI.

Docelowo projekt open-source z potencjałem komercyjnych dodatków.

---

## 1. Cele i założenia

### 1.1. Cele główne

- Uprościć korzystanie z WebSDR-ów:
  - jedna mapa, jedna lista, jeden interfejs.
  - jeden waterfall z płynnym zoomem, bez ręcznego przełączania zakresów.
- Szybko pokazywać „co można usłyszeć”:
  - na podstawie zakresu SDR + szacowanej propagacji.
  - wizualizacja zasięgu w postaci okręgów na mapie.
- Umożliwić użytkownikom tworzenie własnej „mapy ulubionych programów”:
  - zapisane częstotliwości z nazwą i kolorem.
  - widoczne na waterfallu i w liście.

### 1.2. Założenia techniczne

- Web app (SPA / lekkie SSR) – działa w przeglądarce, dobrze na Androidzie.
- Backend w TypeScript/Node.js.
- Frontend w React + TypeScript.
- Open-source (np. MIT/Apache 2), z myślą o ewentualnym:
  - hostowanym SaaS,
  - pluginach/pro funkcjach.

---

## 2. Funkcjonalności (wysoki poziom)

### 2.1. Mapa i lista SDR-ów

- Mapa (OSM) z markerami dla wszystkich WebSDR-ów.
- Możliwość przełączenia widoku:
  - **Mapa** ↔ **Lista** (list view).
- Filtrowanie:
  - po paśmie (LF/MF/HF/VHF/UHF),
  - po kraju / kontynencie,
  - po statusie (online/offline – jeśli możliwe do ustalenia).

### 2.2. Szczegóły stacji SDR

- Po kliknięciu markera/listy:
  - nazwa stacji, opis, lokalizacja, URL WebSDR;
  - dostępne zakresy częstotliwości (np. [0.1–30 MHz], [144–146 MHz], …);
  - informacje o modulacjach (jeśli dostępne – AM/FM/SSB itp.).

- Na mapie wokół stacji:
  - okręgi zasięgu dla wybranych częstotliwości / pasm.
  - na krawędzi każdego okręgu opis (np. `7 MHz`, `14 MHz`, `28 MHz`).

### 2.3. Waterfall

- Jeden główny panel waterfall:
  - pokazuje **pełen dostępny range** dla wybranej stacji.
  - płynny zoom in/out po osi częstotliwości (scroll, pinch).
  - płynne przesuwanie zakresu (drag / pan).
- Czas na osi pionowej (klasyczny waterfall) – przesuwanie w dół/up.
- Brak przełączania „presets dla pasm” – wszystko jest w jednym, ciągłym widoku.

### 2.4. Suwak częstotliwości

- Nad waterfall-em:
  - pionowa linia / wskaźnik częstotliwości (cursor).
  - można go przesuwać:
    - myszą (drag po osi częstotliwości),
    - klawiaturą: ← → (krok konfiguracją, np. 100 Hz / 1 kHz / 5 kHz).
- Aktualnie wybrana częstotliwość widoczna jako:
  - liczba (MHz/kHz/Hz) obok wskaźnika,
  - ewentualnie w dodatkowym panelu z dokładnym odczytem.

### 2.5. Zapisane programy

- Pod waterfall-em:
  - lista zapisanych programów (lokalnie / dla użytkownika).
- Nad waterfall-em:
  - markery (kolorowe znaczniki) na osi częstotliwości z nazwami/etykietami.
- Dodawanie programu:
  - kliknięcie przycisku „Zapisz program” przy aktualnym suwaku.
  - formularz:
    - nazwa (tekst),
    - kolor (wybór z predefiniowanej palety).
  - częstotliwość automatycznie przypisana (wartość z suwaka).
- Edycja/usuwanie programów:
  - zmiana nazwy/koloru,
  - usunięcie.
- Programy mogą być:
  - przechowywane lokalnie (localStorage) – MVP,
  - opcjonalnie synchronizowane przez konto użytkownika – późniejszy etap.

---

## 3. Wymagania niefunkcjonalne

- Minimalistyczny, czytelny interfejs:
  - dark mode domyślnie,
  - brak wizualnego „szumu”.
- Responsywność:
  - dobrze działa na telefonach (Android, iOS),
  - waterfall i mapa dopasowane do mniejszych ekranów.
- Wydajność:
  - płynny waterfall (Canvas/WebGL),
  - minimalne zużycie CPU/baterii, jeśli możliwe.
- Szacunek dla zasobów WebSDR:
  - nieprzesadne odpytywanie serwerów,
  - potencjalny mechanizm rate limiting / cache.

---

## 4. Architektura systemu

### 4.1. Ogólny podział

- **Frontend (SPA)** – React + TS, Vite/Next.js.
- **Backend API** – Node.js + TS (np. NestJS / Express).
- **Baza danych** – Postgres / SQLite (MVP) + Prisma ORM.
- **Usługi pomocnicze**:
  - Crawler WebSDR (okresowe aktualizacje listy),
  - Proxy dla strumieni/waterfalli (jeśli potrzebne ze względu na CORS),
  - Integracja z zewnętrznym API propagacji.

### 4.2. Przepływ danych – wysokopoziomowy

1. Crawler pobiera dane z websdr.org i aktualizuje bazę stacji.
2. Frontend woła:
   - `GET /api/stations` – lista stacji + podstawowe metadane.
3. Użytkownik klika stację:
   - `GET /api/stations/{id}` – szczegóły, zakresy częstotliwości.
   - `GET /api/propagation?stationId=...` – zasięgi dla wybranych częstotliwości.
4. Frontend:
   - rysuje okręgi zasięgu na mapie,
   - inicjuje połączenie do strumienia waterfallu:
     - albo bezpośrednio do WebSDR (jeśli CORS pozwala),
     - albo przez `wss://backend/api/stream/{stationId}` (proxy).
5. Użytkownik zapisuje program:
   - `POST /api/programs` (dla zalogowanych) **lub** zapis w localStorage.

---

## 5. Model danych (wstępny szkic)

```ts
// wspólny pakiet /packages/shared/src/types.ts

export type FrequencyHz = number;

export interface FrequencyRange {
  minHz: FrequencyHz;
  maxHz: FrequencyHz;
}

export interface WebSdrStation {
  id: string;
  name: string;
  description?: string;
  url: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  frequencyRanges: FrequencyRange[];
  modes?: string[]; // np. ["AM", "FM", "USB", "LSB"]
  rawListingSource: 'websdr_org' | 'manual';
  lastSeenAt: string;
  isOnlineEstimated?: boolean;
}

export interface PropagationRing {
  centerLat: number;
  centerLon: number;
  frequencyHz: FrequencyHz;
  radiusKm: number;
}

export interface SavedProgram {
  id: string;
  userId?: string; // null -> program lokalny lub niepowiązany
  stationId: string;
  frequencyHz: FrequencyHz;
  name: string;
  colorHex: string; // np. "#FFAA00"
  createdAt: string;
  updatedAt: string;
}
```

---

## 6. Backend – szczegóły

### 6.1. Stos technologiczny backendu

- Node.js + TypeScript.
- Framework:
  - NestJS (czytelna architektura modułowa) **lub** Express + własny podział warstw.
- ORM: Prisma (postgres/sqlite).
- Harmonogram zadań: node-cron / schedulery systemowe.
- WebSocket (waterfall/proxy): `ws` lub wbudowany mechanizm w NestJS.

### 6.2. Moduły backendu

1. **Module: `Stations`**
   - Endpointy:
     - `GET /api/stations`
       - query: `bbox`, `country`, `band`, `onlineOnly`, `search`.
       - odp: lista `WebSdrStation`.
     - `GET /api/stations/{id}`
       - odp: `WebSdrStation`.
   - Logika:
     - mapowanie pasm (LF/HF itd.) po `frequencyRanges`.
     - proste heurystyki online/offline (ostatnio widziany / test ping).

2. **Module: `WebsdrCrawler`**
   - Zadanie cykliczne, np. co 6h:
     - pobranie strony/danych z websdr.org,
     - parsowanie HTML (np. `cheerio`),
     - ekstrakcja:
       - nazwa,
       - link,
       - współrzędne,
       - zakresy częstotliwości,
       - kraj (jeśli dostępny).
     - zapis/aktualizacja rekordów w DB:
       - dodaj nowe stacje,
       - aktualizuj istniejące,
       - oznacz znikające jako `inactive` (opcjonalne pole).
   - Ewentualnie fallback: ręczne dodawanie stacji.

3. **Module: `Propagation`**
   - Abstrakcja na zewnętrzne API:
     - interfejs np. `IPropagationProvider`.
   - Endpointy:
     - `GET /api/propagation?stationId=...`
       - optional: `freqs=7000000,14000000,28000000` itp.
       - odp: lista `PropagationRing`.
   - Implementacja MVP:
     - na początek _prosty model_:
       - dla HF oblicz promień wg uproszczonych zasad (np. funkcje/konfiguracja),
       - później podmiana na zewnętrzne API (VOACAP/inne).
     - konfiguracja i łatwa podmiana implementacji.

4. **Module: `StreamingProxy` (opcjonalne)**
   - Potrzebny, jeśli:
     - CORS/WebSocket nie pozwala łączyć się bezpośrednio z WebSDR.
   - Endpointy:
     - `GET /api/stream/{stationId}` – HTTP chunked / SSE.
     - `GET /api/waterfall/{stationId}` – pass-through do źródła.
     - `WS /api/ws/stream/{stationId}` – proxy WebSocket.
   - Logika:
     - z mapowania w DB/w konfiguracji zna adresy endpointów waterfall/audio dla danej stacji.
     - przekazuje dane niemodyfikowane dalej do frontu.
   - Uwaga: ten moduł może wymagać indywidualnych „adapterów” per typ WebSDR (różne instalacje mogą mieć drobne różnice).

5. **Module: `Programs`**
   - Endpointy:
     - `GET /api/programs` – dla zalogowanego usera.
     - `POST /api/programs` – tworzenie.
     - `PATCH /api/programs/{id}` – edycja.
     - `DELETE /api/programs/{id}` – usunięcie.
   - MVP:
     - endpointy aktywne tylko przy włączonej autoryzacji JWT/Session.
     - dla trybu bez logowania – logika po stronie frontu (localStorage).

6. **Module: `Auth` (opcjonalny, później)**
   - Logowanie przez:
     - OAuth (GitHub/Google) **lub** proste e-mail/hasło.
   - Tokeny JWT lub sesje HTTP (cookies).

### 6.3. Baza danych – schemat (Prisma, uproszczony)

```prisma
model Station {
  id               String    @id @default(cuid())
  name             String
  description      String?
  url              String
  latitude         Float
  longitude        Float
  countryCode      String?
  rawListingSource String
  lastSeenAt       DateTime?
  isActive         Boolean   @default(true)

  ranges           StationFrequencyRange[]
  programs         Program[]
}

model StationFrequencyRange {
  id        String  @id @default(cuid())
  station   Station @relation(fields: [stationId], references: [id])
  stationId String
  minHz     Int
  maxHz     Int
}

model Program {
  id          String   @id @default(cuid())
  station     Station? @relation(fields: [stationId], references: [id])
  stationId   String?
  user        User?    @relation(fields: [userId], references: [id])
  userId      String?
  frequencyHz Int
  name        String
  colorHex    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model User {
  id       String    @id @default(cuid())
  email    String    @unique
  password String?
  programs Program[]
}
```

---

## 7. Frontend – szczegóły

### 7.1. Stos frontendowy

- React + TypeScript.
- Vite (szybki dev) lub Next.js (SSR/SSG – jeśli SEO ma znaczenie).
- UI:
  - TailwindCSS (minimalistyczny styling),
  - Headless UI / Radix dla komponentów.
- Zarządzanie stanem:
  - React Query (dane z API),
  - Zustand / Redux Toolkit dla stanu UI (wybrany SDR, zoom, itp.).

### 7.2. Główne widoki

1. **Main layout**
   - Top bar (logo/nazwa, przełącznik: mapa/lista, ustawienia).
   - Górna część: mapa **lub** lista.
   - Dolna część: waterfall + suwak + programy.

2. **Mapa SDR**
   - komponent `MapView` (Leaflet / MapLibre + OSM tiles).
   - Markery:
     - klasteryzacja przy dużym zagęszczeniu (np. Leaflet.markercluster).
     - kolor markera wg statusu (np. online/offline).
   - Po kliknięciu:
     - podświetlenie stacji,
     - wyświetlenie panelu szczegółów obok lub jako tooltip.
   - Okręgi propagacji:
     - rysowane jako `Circle`/`CircleMarker` w bibliotece mapowej.
     - opis częstotliwości na krawędzi (np. leaflet-rotated-markers / warstwa tekstowa).

3. **Lista SDR**
   - komponent `StationListView`:
     - sortowanie (nazwa, kraj, odległość od użytkownika),
     - filtrowanie (pasmami, krajem itd.).
   - Po kliknięciu: wybór stacji, przewinięcie do jej pozycji na mapie (jeśli mapa równolegle widoczna – w desktop layout).

4. **Panel szczegółów stacji**
   - komponent `StationDetailsPanel`:
     - nazwa, lokalizacja, link „Open original WebSDR”,
     - lista `frequencyRanges`,
     - wybrane parametry (modulacje, itp.).
   - Przyciski:
     - „Ustaw waterfall na stację”,
     - „Dodaj do ulubionych stacji” (opcjonalnie).

5. **Waterfall**
   - komponent `WaterfallView`:
     - `HTMLCanvasElement` lub WebGL (dla wydajności).
     - przyjmuje strumień danych „linii” (każda linia = widmo w danym momencie).
     - pozioma oś: częstotliwość.
     - pionowa oś: czas (najnowsze u góry / na dole – do ustalenia).
   - Funkcje:
     - zoom in/out na osi częstotliwości:
       - scroll + ctrl/alt,
       - pinch na touch.
     - pan:
       - drag lewo/prawo zmienia zakres częstotliwości.
   - Integracja z suwakiem:
     - suwak to pionowa linia na canvasie, pozycja = `selectedFrequency`.

6. **Suwak częstotliwości**
   - komponent `FrequencyCursor`:
     - rysowany nad waterfall-em:
       - pionowa linia,
       - label z częstotliwością.
   - Sterowanie:
     - mysz:
       - kliknięcie w waterfall ustawia `selectedFrequency`.
       - drag przesuwa linię.
     - klawiatura:
       - ← → zmiana o `stepHz` (konfigurowalny w ustawieniach).
       - `Shift + ←/→` – większy krok.
   - Panel odczytu:
     - „Aktualna częstotliwość: 7.074.000 MHz (USB)”.

7. **Programy**
   - komponenty:
     - `SavedProgramsBar` (nad waterfall-em – markery),
     - `SavedProgramsList` (pod waterfall-em – tabela/lista).
   - Markery:
     - w osi częstotliwości – małe kolorowe „piny”,
     - po najechaniu – tooltip z nazwą.
     - po kliknięciu – ustawienie suwaka na częstotliwości programu.
   - Lista:
     - nazwa, częstotliwość, stacja, kolor.
     - przyciski: edycja, usunięcie.
   - Dialog „Dodaj program”:
     - otwierany przyciskiem „Zapisz program”.
     - pola:
       - nazwa (required),
       - kolor (paleta kilku sprawdzonych kolorów),
       - częstotliwość – tylko do podglądu, bez możliwości edycji.

### 7.3. Zarządzanie stanem

Przykładowy globalny state (Zustand):

```ts
interface UiState {
  selectedStationId: string | null;
  selectedFrequencyHz: number | null;
  frequencyViewRangeHz: { minHz: number; maxHz: number }; // aktualny zakres waterfallu
  programs: SavedProgram[]; // dla trybu lokalnego
  viewMode: 'map' | 'list';
  // akcje
  setSelectedStation(id: string | null): void;
  setSelectedFrequency(hz: number): void;
  setFrequencyViewRange(range: { minHz: number; maxHz: number }): void;
  addLocalProgram(program: SavedProgram): void;
  updateLocalProgram(id: string, patch: Partial<SavedProgram>): void;
  deleteLocalProgram(id: string): void;
  setViewMode(mode: 'map' | 'list'): void;
}
```

---

## 8. Interakcje użytkownika (UX)

### 8.1. Scenariusz typowy

1. Użytkownik otwiera aplikację:
   - widzi mapę z markerami + watermark OSM.
2. Użytkownik klika stację:
   - pojawia się panel z informacjami,
   - automatycznie ładuje się waterfall dla tej stacji (MVP).
3. Na mapie pojawiają się okręgi z zasięgiem dla kilku podstawowych częstotliwości.
4. Użytkownik:
   - przybliża waterfall na interesującą częstotliwość,
   - ustawia suwak,
   - ewentualnie otwiera audio (w przyszłości – integracja audio).
5. Użytkownik zapisuje program:
   - nadaje nazwę „40m FT8 EU”,
   - wybiera kolor.
6. Przy kolejnym wejściu:
   - widzi markery programów na waterfall-u,
   - może jednym kliknięciem przeskoczyć w odpowiedni rejon.

### 8.2. Klawisze/skróty

- `←` / `→` – krokowa zmiana częstotliwości.
- `Shift + ←/→` – większy krok.
- `+` / `-` – zoom in/out osi częstotliwości.
- `M` – przełącz mapa/lista.
- `S` – otwórz dialog „Zapisz program”.

---

## 9. Integracja z WebSDR i waterfall

### 9.1. Zbieranie metadanych

- Crawler:
  - parsuje tabelę/listę WebSDR-ów (HTML),
  - stara się wykryć:
    - zakresy częstotliwości (często umieszczone w tekście opisu),
    - link do interfejsu WebSDR.
- Jeśli w przyszłości websdr.org udostępni JSON/API:
  - podmienić implementację crawla na bezpośrednie API.

### 9.2. Dostęp do waterfallu

- Każda instancja WebSDR może:
  - udostępniać waterfall / dane widma przez własne endpointy (AJAX/WS),
  - lub wymagać użycia oryginalnej strony (iframe) – w najgorszym przypadku.

#### Minimalny MVP:

- **Faza 1:**
  - tylko metadane + link „Otwórz WebSDR w nowej karcie”.
  - nasz waterfall jest _testowy_ – np. tylko dla kilku stacji, które mają znaną strukturę API.
- **Faza 2:**
  - analiza typowego WebSDR,
  - stworzenie adaptera, który:
    - łączy się do endpointu waterfall (np. AJAX/WS),
    - konwertuje dane na prosty format, np.:
      ```ts
      interface WaterfallLine {
        timestamp: number;
        freqStartHz: number;
        freqStepHz: number;
        magnitudes: Uint8Array; // intensywności
      }
      ```
    - wysyła to przez WebSocket/eSSE do frontu.

### 9.3. Problemy techniczne i obejścia

- CORS:
  - jeśli WebSDR nie zezwala na cross-origin:
    - użyć backendowego proxy, które:
      - robi request do WebSDR,
      - dodaje odpowiednie nagłówki CORS,
      - streamuje dane do klienta.
- Ograniczenia przepustowości:
  - w UI dodać kontrolę „Update rate” (np. normal/slow).
  - w backendzie wprowadzić throttling (np. co X ms jedna linia).

---

## 10. Szacowanie zasięgu (propagacja)

### 10.1. MVP – model uproszczony

- Konfiguracja statyczna:
  - dla pasm (np. 3.5 MHz, 7 MHz, 14 MHz, 21 MHz, 28 MHz…) zdefiniować:
    - minimalny / maksymalny typowy zasięg w dzień/noc.
- Dla danej stacji:
  - na podstawie aktualnej godziny UTC wybieramy zestaw:
    - `radiusKm` dla każdej z kilku częstotliwości reprezentatywnych.
- Dla UI:
  - narysować okręgi np. dla 4–5 częstotliwości:
    - podpis `3.5 MHz`, `7 MHz` itd.

### 10.2. Docelowo – integracja z zewnętrznym API

- Interfejs `IPropagationProvider`:
  ```ts
  interface IPropagationProvider {
    getRingsForStation(station: WebSdrStation, freqsHz: number[]): Promise<PropagationRing[]>;
  }
  ```
- Implementacja może:
  - korzystać z zewnętrznych serwisów propagacyjnych (MUF, SNR maps),
  - uwzględniać:
    - porę dnia,
    - SFI, Kp index,
    - przypuszczalne ścieżki (NVIS, F-layer itd. – na później).

---

## 11. Persistencja programów

### 11.1. Tryb lokalny (bez logowania) – MVP

- Programy przechowywane w `localStorage` pod kluczem:
  - `websdr-atlas.programs.v1`.
- Struktura zapisów:
  ```ts
  interface LocalProgramsState {
    programs: SavedProgram[];
  }
  ```
- Przy starcie aplikacji:
  - odczyt z localStorage,
  - walidacja danych,
  - wgranie do stanu UI.

### 11.2. Tryb zalogowany (później)

- Programy przechowywane w DB po stronie backendu.
- Synchronizacja:
  - po logowaniu – pobierz listę z API.
  - przy zmianie – wyślij patch na backend.

---

## 12. UI/UX – styl i zasady

- Motyw:
  - tło: ciemne (ciemny granat/ciemny szary),
  - waterfall: odcienie jasno-ciemne + kolorystyka ciepło/zimno dla intensywności.
- Typografia:
  - bezszeryfowe, proste fonty (np. Inter/Roboto).
- Kolory programów:
  - ograniczona paleta, żeby nie robić „choinki”.
- Minimalizm:
  - mało ramek, dużo „powietrza”,
  - brak zbędnych tooltipów/ikonek – tylko te niezbędne.

---

## 13. Struktura repozytorium

Przykładowy monorepo (pnpm/turborepo):

```
/websdr-atlas
  /apps
    /frontend   # React
    /backend    # Node/NestJS
  /packages
    /shared     # Typy TS, utils współdzielone
  /infra
    Dockerfile.backend
    Dockerfile.frontend
    docker-compose.yml
  README.md
  CONTRIBUTING.md
```

---

## 14. Plan wdrożenia (fazy)

### Faza 0 – inicjalizacja projektu

- Ustalenie stosu: React + Vite / Next.js, NestJS/Express, Prisma.
- Skonfigurowanie monorepo, lintów, formatera (ESLint + Prettier).
- Przygotowanie podstawowego CI (test, build).

### Faza 1 – Core backend

- Schemat DB (Station, StationFrequencyRange).
- Moduł `Stations`:
  - `GET /api/stations`,
  - `GET /api/stations/{id}`.
- Prosty `WebsdrCrawler` z parsowaniem HTML.

### Faza 2 – Core frontend

- Layout: mapa + waterfall placeholder + lista programów.
- `MapView` z markerami stacji (bez okręgów).
- `StationListView`.
- Wybór stacji + podstawowy panel szczegółów.

### Faza 3 – Waterfall (MVP)

- Implementacja `WaterfallView`:
  - testowy generator danych (noise) na potrzeby UI.
- Suwak częstotliwości + sterowanie myszą i klawiaturą.
- Możliwość zmiany zoomu/panu.

### Faza 4 – Programy (MVP)

- `SavedProgramsBar` + `SavedProgramsList`.
- LocalStorage persistencja.
- Dodawanie/edycja/usuwanie programów.

### Faza 5 – Propagacja (MVP)

- Prosty model promieni dla kilku częstotliwości / pasm.
- Rysowanie okręgów na mapie z etykietami częstotliwości.

### Faza 6 – Integracja z prawdziwym WebSDR

- Analiza 1–2 typowych instancji WebSDR.
- Implementacja prostego `StreamingProxy` dla waterfallu.
- Podmiana testowych danych waterfallu na rzeczywiste z jednej stacji (pilot).

### Faza 7 – szlify i przygotowanie open-source

- README z opisem projektu, roadmapą, guideline dla kontrybutorów.
- CONTRIBUTING.md, CODE_OF_CONDUCT.
- Wstępne issues/tasks do community.

---

## 15. Wytyczne dla agenta implementacyjnego (Cursor/Copilot/GPT)

1. **Nie skracaj architektury** – trzymaj się powyższego podziału modułów.
2. **Zacznij od backendu `Stations` + prostego frontu**:
   - najpierw bazowy przepływ: mapa/lista → wybór stacji.
3. **Waterfall implementuj na Canvasie**:
   - najpierw z generatorem testowych danych,
   - dopiero potem integracja z prawdziwymi WebSDR-ami.
4. **Programy MVP tylko lokalnie** (localStorage):
   - API `Programs` i `Auth` można dodać w późniejszej fazie.
5. **Kod pisz modułowo**:
   - typy w `/packages/shared`,
   - UI w małych, prostych komponentach.
6. **Zadbaj o wydajność**:
   - ogranicz re-rendering komponentów waterfallu,
   - używaj `requestAnimationFrame` / batched updates.
7. **Dokumentuj miejsca „stubowe”**:
   - gdzie używany jest prosty model propagacji,
   - gdzie testowy generator waterfallu,
   - gdzie planowane jest podpięcie zewnętrznego API.
