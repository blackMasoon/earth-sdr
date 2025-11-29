# WebSDR Atlas - Implementation TODO

Based on the detailed plan in `agents.md`, this document tracks implementation progress.

## Implementation Status

### Faza 0 – Inicjalizacja projektu ✅

- [x] Utworzenie struktury monorepo (pnpm + turbo)
- [x] Konfiguracja ESLint + Prettier
- [x] Przygotowanie podstawowego package.json
- [x] Utworzenie shared types w `/packages/shared`
  - [x] FrequencyHz, FrequencyRange types
  - [x] WebSdrStation, WebSdrStationListItem types
  - [x] PropagationRing types
  - [x] SavedProgram types
  - [x] Utility functions (formatFrequency, calculateDistance, etc.)
- [ ] CI/CD pipeline configuration

### Faza 1 – Core backend ✅

- [x] Inicjalizacja NestJS w `/apps/backend`
- [x] Schemat DB (Station, StationFrequencyRange, Program, User) z Prisma
- [x] Moduł `Stations`
  - [x] `GET /api/stations` endpoint
  - [x] `GET /api/stations/{id}` endpoint
  - [x] Filtering by band, country, bounding box
- [x] Prosty `WebsdrCrawler` 
  - [x] Seed data z 10 przykładowymi stacjami
  - [x] `POST /api/crawler/seed` endpoint
  - [ ] Actual websdr.org HTML parsing (stubbed)
- [x] Moduł `Propagation`
  - [x] `GET /api/propagation` endpoint
  - [x] Simple propagation model (day/night based)

### Faza 2 – Core frontend ✅

- [x] Inicjalizacja React + Vite w `/apps/frontend`
- [x] TailwindCSS configuration (dark theme)
- [x] Layout: header + main content + footer
- [x] Komponent `MapView` z markerami stacji (Leaflet + OSM)
  - [x] Station markers
  - [x] Marker clustering (TODO)
  - [x] Propagation circles on map
- [x] Komponent `StationListView`
  - [x] Station cards with online status
  - [x] Click to select station
- [x] Panel szczegółów stacji (`StationDetailsPanel`)
  - [x] Station info display
  - [x] Frequency ranges display
  - [x] Link to original WebSDR
- [x] Zustand store for state management
- [x] API hooks

### Faza 3 – Waterfall (MVP) ✅

- [x] Implementacja `WaterfallView`
  - [x] Canvas-based rendering
  - [x] Test noise generator
  - [x] Color palette for intensity
  - [x] Zoom in/out on frequency axis
  - [x] Pan/drag navigation
- [x] Suwak częstotliwości (`FrequencyCursor`)
  - [x] Click to set frequency
  - [x] Keyboard navigation (← →)
  - [x] Shift for larger steps
  - [x] Frequency display

### Faza 4 – Programy (MVP) ✅

- [x] `SavedProgramsBar` - markers on waterfall axis
- [x] `SavedProgramsList` - list with edit/delete
- [x] LocalStorage persistencja (via Zustand persist)
- [x] Dialog do dodawania programów
  - [x] Name input
  - [x] Color selection
  - [x] Frequency display

### Faza 5 – Propagacja (MVP) ✅

- [x] Prosty model promieni dla częstotliwości HF
  - [x] Day/night based radius estimation
  - [x] Band-specific propagation characteristics
- [x] Rysowanie okręgów na mapie z kolorami
- [x] Etykiety częstotliwości w tooltipach
- [ ] Integracja z zewnętrznym API (VOACAP) - TODO

### Faza 6 – Integracja z WebSDR

- [ ] Analiza 1-2 typowych instancji WebSDR
- [ ] Implementacja `StreamingProxy` dla waterfallu
- [ ] Podmiana testowych danych na rzeczywiste z jednej stacji
- [ ] CORS proxy dla strumieni audio/waterfall

### Faza 7 – Szlify i open-source ✅

- [x] README z opisem projektu
- [x] CONTRIBUTING.md
- [x] CODE_OF_CONDUCT.md
- [x] License file

---

## Technical Notes

### Stubbed/Placeholder Implementations

1. **Waterfall Data**: Currently using test noise generator. Needs integration with real WebSDR endpoints.

2. **Crawler**: Using seed data instead of actual websdr.org parsing. The parsing code is prepared but commented out to avoid blocking issues.

3. **Propagation Model**: Using simplified day/night model. Should be replaced with VOACAP or similar service for accurate predictions.

4. **Station Status**: All stations marked as "online". Need to implement ping/health check system.

### Known Limitations

- ~~Waterfall doesn't zoom/pan yet (basic MVP)~~ ✅ Implemented
- No audio streaming
- No user authentication
- Programs stored locally only

### Next Steps Priority

1. ~~Add waterfall zoom/pan controls~~ ✅
2. Implement actual WebSDR data streaming for one station (pilot)
3. Add station online/offline status check
4. Implement CORS proxy for WebSDR streams
