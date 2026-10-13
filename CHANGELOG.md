# Changelog

Alle Versionen der Integration. Die Nummern folgen [Semantic Versioning](https://semver.org/lang/de/):
**Major** bei Änderungen, die bestehende Einrichtungen brechen oder Funktionen entfernen,
**Minor** für neue Funktionen, **Patch** für Fehlerbehebungen.

Jeder Abschnitt wird beim Push automatisch zu einem [GitHub-Release](https://github.com/Ga-Re/HAWeightTracker/releases)
(siehe `.github/workflows/release.yml`). HACS zeigt diese Releases als Updates an.

## [2.5.0] – 2026-10-13

### Neu
- **Neue Übersicht im Stil der Xiaomi-App**, eine Person nach der anderen (Umschalter oben): großes Gewicht mit Einstufung, Körperbewertung in Punkten, Körperzusammensetzung, Kacheln mit Bewertung, Körpertyp-Matrix und Vorschläge zum Gewicht.
- **Neue Körperwerte:** Körperbewertung, Viszeralfett, Eiweißanteil und -masse, Körperalter, Skelettmuskelmasse, fettfreie Masse, Fett- und Wassermasse, Standardgewicht, Fett- und Muskelkontrolle (Algorithmen nach bodymiscale), auch als HA-Sensoren.
- **Zweiter Impedanz-Sensor** für Waagen mit zwei Frequenzen (Xiaomi S400: „Impedance High“). Die Formeln nutzen den größeren, also den 50-kHz-Wert.
- **Herzfrequenz-Sensor** der Waage (Kachel und HA-Sensor).
- **KI-Hinweise** über die AI-Task-Funktion von Home Assistant: Der Admin wählt die KI, jede Person stimmt für sich zu. Auswertung nach jeder Messung (höchstens stündlich) und per Knopf.

### Geändert
- Körperfett wird nach den Xiaomi-Tabellen eingestuft (statt Gallagher), passend zu den übrigen Formeln.

## [2.4.0] – 2026-10-13

### Neu
- **Waagen mit „Stabilized“-Sensor (z. B. Xiaomi Body Composition Scale S400):** Neues Feld *Stabilisiert-Sensor* unter *Einstellungen → Sensoren der Waage*. Jedes Umschalten auf „an“ zählt als Messung, auch wenn das Gewicht gleich geblieben ist. Die S400 sendet nur das fertige Gewicht, gleiche Werte gingen bisher verloren.
- Beim Wählen des Gewichtssensors werden Stabilisiert- und Impedanz-Sensor desselben Geräts vorgeschlagen (bei der S400 „Impedance Low“).

### Behoben
- Eine unveränderte Impedanz (oder andere Zusatzwerte) wurde als „zu alt“ verworfen, weil nur Änderungen zählten. Jetzt zählt auch ein erneut gemeldeter gleicher Wert.

## [2.3.0] – 2026-10-10

### Neu
- **Kleidungsfrage mit Knöpfen** in der Nachricht nach dem Wiegen: „👕 Mit Kleidung“ / „Ohne Kleidung“ (Actionable Notifications der Home-Assistant-App). Danach ersetzt eine Bestätigung die Frage. Die Frage kommt auch, wenn die normale Nachricht nach dem Wiegen aus ist.
- Testnachricht mit Knopf „✓ Knopf testen“, um den ganzen Weg zu prüfen.
- Einstellungen als **aufklappbare Abschnitte** mit Icons wie in den HA-Einstellungen. Offene Abschnitte merkt sich der Browser.

### Behoben
- Monat und Jahr beim Geburtsmonat standen nicht auf einer Höhe.

## [2.2.0] – 2026-10-09

### Neu
- Eigener Abschnitt **„Sensoren der Waage“**: Gewicht, Impedanz, Körperfett, Muskelmasse, Körperwasser, Knochenmasse, Grundumsatz.
- „Sensoren“ heißt jetzt **„Werte als HA-Sensoren“**.

### Geändert
- Alle Formularfelder haben ihre Beschriftung oben und stehen bündig, höchstens drei Spalten.
- Diagramme nutzen die volle Kartenbreite.

## [2.1.0] – 2026-10-09

### Neu
- **Kleidung:** Messungen als „mit Kleidung“ markieren. Das Kleidungsgewicht (Startwert 0,8 kg) wird gelernt und abgezogen. Jede Person schaltet es unter *Meine Daten* selbst ein.

## [2.0.0] – 2026-10-09

### Neu
- Unter *Einstellungen → Sensoren* einzeln wählen, welche Werte pro Person, Haustier und Kind als Sensor angelegt werden. „Sensoren anlegen“ aus 1.x wird zu „alle Sensoren“.
- Haustier-Messungen zeigen immer, wer gewogen hat.

### Geändert
- Nur Admins wählen das Benachrichtigungs-Gerät einer Person. Personen wählen selbst, welche Nachrichten sie bekommen.

### Entfernt
- **Erfolge** (Abzeichen, Serien, Meilenstein-Nachrichten) komplett entfernt.

### Behoben
- Das Diagramm eines Haustiers reagierte auf die Maus über dem Personen-Diagramm.

## [1.9.0] – 2026-10-09

### Neu
- Warnung, wenn ein Haustier ungewöhnlich schnell zu- oder abnimmt (Karte und einmalige Nachricht).
- Notizen im Verlauf von Haustieren (Tierarzt, Impfung, Futter, Medikament).
- **Kinder** mit Perzentilen und Wachstumskurve (WHO 0–2 Jahre, CDC 2–20 Jahre).
- Anzeige in **kg, lb oder st** pro Gerät.

## [1.8.0] – 2026-10-09

### Neu
- Prognose zum Ziel im Diagramm, Kalender-Heatmap, CSV-Export und -Import (Withings, Zepp/Mi Fit, Garmin, eigene Tabellen).
- Dashboard-Karte `custom:weight-tracker-card`.

## [1.7.0] – 2026-10-09

### Neu
- Geschlecht und Taillenumfang (Taille-zu-Größe-Verhältnis).
- Körperzusammensetzung aus Impedanz oder direkten Werten der Waage, nur wenn die Waage sie liefert.
- Notizen an Messungen.

## [1.6.0] – 2026-10-09

### Neu
- Persönliche Benachrichtigungen: nach dem Wiegen, Erinnerung nach N Tagen, Testnachricht.

## [1.5.3] – 2026-10-09

### Geändert
- „Messung eintragen“ steht über den Listen.

### Behoben
- Falsche Spaltenüberschrift „Erkannt“. Haustier-Vorschläge erschienen doppelt in der Liste.

## [1.5.2] – 2026-10-09

### Neu
- Bilder der HA-Personen als Avatar. *Meine Daten* wird über den Stift auf den Kacheln bearbeitet.

## [1.5.1] – 2026-10-09

### Behoben
- Auswahlfelder (Monat, Tierart, Person) zeigten den gewählten Wert nicht an.

## [1.5.0] – 2026-10-09

### Neu
- **Haustiere** per Differenzmessung, per Knopf oder automatisch vorgeschlagen.
- Geburtsmonat und -jahr statt Geburtsdatum (wird automatisch übernommen).
- Neu gestaltete Seite *Meine Daten*.

## [1.4.2] – 2026-10-09

### Geändert
- Geburtsdatum mit Feldern für Tag, Monat und Jahr.

### Behoben
- Verknüpfung der Werte mit ihren HA-Sensoren robuster.

## [1.4.1] – 2026-10-09

### Geändert
- Eigene Daten werden im Tab *Meine Daten* bearbeitet statt in der Übersicht.

## [1.4.0] – 2026-10-09

### Neu
- Klick auf einen Wert öffnet die Entitätsansicht von Home Assistant.
- Personen bearbeiten Größe, Ziel und Geburtsdatum selbst.

## [1.3.2] – 2026-10-07

### Neu
- Icon der Integration.

### Behoben
- Nach dem Speichern zeigte das Panel „Noch keine Waage eingerichtet“.

## [1.3.1] – 2026-10-07

### Geändert
- Formulare nutzen die Eingabefelder von Home Assistant (Entitätsauswahl mit Filter usw.).

## [1.3.0] – 2026-10-07

Erste veröffentlichte Version: automatische Personenerkennung, Trend und Statistiken, Panel „Gewicht“ in der Seitenleiste, Freigaben pro Benutzer, Deutsch und Englisch.
