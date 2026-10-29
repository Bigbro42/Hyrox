# HYROX Trainer

Persönliche Trainings-App (PWA) für die Vorbereitung auf HYROX Mixed Doubles – mit Physio-Programm, Knie-Monitoring, Kalender und Fortschritt. Für eine Person, alle Daten bleiben lokal auf dem Gerät.

**App:** https://bigbro42.github.io/Hyrox/

Design und Technik basieren auf [FORM.](https://github.com/Bigbro42/form-fitness) (Aufbau, Datenhaltung, Komponenten), in den HYROX-Farben Schwarz und Gelb. FORM. selbst wurde nicht verändert.

## Installation auf dem Handy

- **iPhone:** Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
- **Android:** Link in Chrome öffnen → Menü → „App installieren“.

Nach dem ersten Öffnen funktioniert die App auch offline.

## Funktionen

- **Heute:** geplante Einheit mit Start-Button, Knie-Ampel und Knie-Check, Wochenleiste, Countdown, Level und Meilensteine.
- **Training:** Einheiten A (Physio & Knie), B (Kraft & Ausdauer), C (HYROX Mixed Doubles) als bearbeitbare Vorlagen, Satzprotokoll mit kg, Wiederholungen, Metern oder Sekunden und Zeit, Pausentimer, Laufleiter (9 Stufen), 16-Wochen-Plan mit Phasen.
- **Kalender:** Monats- und Wochenansicht, Standardwoche aus den Einstellungen, einzelne Termine verschieben und auslassen, Fußball eintragen, Warnung bei intensiven Tagen direkt hintereinander.
- **Physio:** alle 15 Übungen mit Beschreibung, Muskeln, Equipment, Ausführung, Fehlern, Sicherheit und Alternativen. Status pro Übung: Basis, Optional, Spätere Progression oder Gesperrt (individuell änderbar). Knie-Verlauf.
- **Fortschritt:** Trainingshäufigkeit, Knie-Beschwerden, Stationen-Bestwerte, Lauftempo, Kraft (geschätztes 1RM), persönliche Rekorde, Meilensteine und eine nachvollziehbare Zielzeit-Schätzung aus den eigenen Daten.
- **Daten:** JSON-Backup, CSV-Export (Trainings und Kniewerte), Import mit Vorschau, automatische Sicherungen vor jedem Import.

## Grundregeln

- **Keine Diagnose.** Die Knie-Ampel ist ein transparentes Schmerz-Monitoring (grün bis 2/10, gelb bis 4/10, sonst rot; Grenzen einstellbar). Sprünge und durchgehendes Laufen werden nie automatisch freigegeben.
- **Gamification ohne Druck.** XP für abgeschlossene Einheiten und Kniewerte, keine Serien, keine Strafen für Ruhetage.
- **Training ≠ Termin.** Nur abgeschlossene Einheiten zählen. Abgeschlossene Trainings speichern eine Kopie ihrer Übungen und ändern sich durch spätere Vorlagen nicht.
- **Keine Gesundheitsdaten im Repository.** Persönliche Angaben (Körperdaten, Kniewerte) gibt es nur lokal in der App.

## Datenübernahme aus der ersten Version

Die bisherige Version speicherte unter `localStorage` → `form-hyrox-trainer-v1`. Beim Start liest die neue App diesen Wert, legt eine Rohdaten-Sicherung an und übernimmt ihn in IndexedDB (`hyrox-trainer`). Der alte Wert wird nie verändert oder gelöscht; abgeschlossene Trainings, Knie-Checks, geänderte Vorlagen, eigene Übungen, Fußballtag und Partnername werden übernommen. Alte JSON-Backups lassen sich weiterhin importieren.

## Entwicklung

Quellcode in `app/` (Vite, TypeScript, Preact, IndexedDB über `idb`).

```bash
cd app
npm ci
npm run dev          # Entwicklung
npm run typecheck
npm test             # Unit-Tests (Vitest)
npm run test:e2e     # Browser-Tests (Playwright, Chromium mit iPhone-Profilen)
npm run release      # Build und Kopie in den Repository-Root (GitHub Pages)
```

GitHub Pages veröffentlicht den Root des Branches `main`. Nach jeder Änderung `npm run release` ausführen und die Root-Dateien mit committen – die CI (`.github/workflows/validate.yml`) prüft das.

| Ordner | Inhalt |
| --- | --- |
| `app/src/data` | Übungsinhalte (Physio, HYROX-Stationen, Kraft/Ausdauer) |
| `app/src/domain` | Datenmodell, Kalender, Knie-Ampel, Phasen, Laufleiter, Fortschritt, XP |
| `app/src/db`, `app/src/backup`, `app/src/legacy` | IndexedDB, Backup/CSV, Übernahme der ersten Version |
| `app/src/ui` | Designsystem und Bildschirme |

## Hinweise

Unabhängiger, inoffizieller Trainingsplaner – keine App des Veranstalters HYROX und kein Medizinprodukt. Regeln und Gewichte (Rulebook Doubles 26/27) und den Renntermin vor dem Wettkampf auf hyrox.com prüfen. Körperkarte: Body Muscles (Apache-2.0, siehe `app/third-party`); Übungsfotos: Free Exercise DB (gemeinfrei).
