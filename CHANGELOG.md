# Changelog

Alle Versionen der Integration. Die Nummern folgen [Semantic Versioning](https://semver.org/lang/de/):
**Major** bei Änderungen, die bestehende Einrichtungen brechen oder Funktionen entfernen,
**Minor** für neue Funktionen, **Patch** für Fehlerbehebungen.

Jeder Abschnitt wird beim Push automatisch zu einem [GitHub-Release](https://github.com/Ga-Re/HAWeightTracker/releases)
(siehe `.github/workflows/release.yml`). HACS zeigt diese Releases als Updates an.

## [2.16.0] – 2026-10-15

### Geändert
- **Anpassen der Übersicht:** *Fertig* und *Zurücksetzen* schweben jetzt unten rechts (wie der +-Knopf), statt ganz unten unter allen Karten zu stehen.
- **Vorschläge zum Gewicht** neu gestaltet: echte Icons (Material Design Icons wie in Home Assistant) statt Emojis, eingefärbt in der Farbe der Bewertung. Jeder Wert zeigt die Menge ohne Vorzeichen und darunter, was zu tun ist (abnehmen / zunehmen / im Standard, Fett abbauen / Spielraum, aufbauen / im Normalbereich). In Größe S steht die Gewichtskontrolle im Mittelpunkt, das Standardgewicht als Zeile darunter.
- Der Knopf *Anpassen* hat ein Stift-Icon statt des ✎-Zeichens.

## [2.15.0] – 2026-10-15

### Neu
- **Übersicht als Raster mit Widget-Karten:** 4 Spalten am PC, 2 an Tablet und Handy. Jede Karte hat feste Größen (S = 1×1, M = 2×1, L = 2×2, XL = ganze Breite × 2 Zeilen) und zeigt je nach Größe mehr oder weniger Inhalt. Karten gleicher Größe sind immer exakt gleich groß; passt der Inhalt nicht hinein, wird er unten ausgeblendet und **Mehr** öffnet die ganze Karte. Kleinere Karten füllen Lücken neben größeren.
- **✎ Anpassen** direkt in der Übersicht: Größe ändern, verschieben (← →), ausblenden (✕), wieder einblenden, zurücksetzen. Gespeichert pro Benutzer und Gerät.
- Körpertyp und Vorschläge zum Gewicht sind zwei eigene Karten; die Körperwerte sind fünf Karten (Fett und Wasser, Muskeln und Knochen, Stoffwechsel, Herz und Fitness, weitere Kennzahlen) statt Reitern.
- Auf dem Handy werden einige Karten kompakter (z. B. Bewertungspunkt neben dem Wert), XL zeigt dort den Inhalt von L.
- Startanordnung: Gewicht L, daneben Körperbewertung und KI-Hinweise (M), dann Figur und Körpertyp (L), Vorschläge und Körperwerte (M), Herz und Fitness (L).

### Behoben
- Die Bewertung unter der Punktzahl der Körperbewertung war immer grau statt farbig.

## [2.14.0] – 2026-10-15

### Neu
- **KI-Anweisungen anpassen:** Admins können unter *Einstellungen → Verwaltung → KI-Hinweise* den Prompt ändern. Das Feld ist mit dem Standard-Prompt vorausgefüllt; *Auf Standard zurücksetzen* stellt ihn wieder her. Die freigegebenen Messwerte jeder Person werden immer automatisch angehängt. Gespeichert wird nur ein eigener Text – der Standard bleibt so bei Updates aktuell.

### Behoben
- Aktivitätslevel, Gesamtumsatz und VO₂max kamen trotz Freigabe nicht bei der KI an (im Prompt fehlte ihre Beschriftung).

## [2.13.0] – 2026-10-15

### Neu
- **Verlauf für weitere Werte:** Im Tab *Verlauf* lässt sich neben dem Gewicht auch BMI, Körperfett, Fettmasse, fettfreie Masse, Muskelmasse, Skelettmuskelmasse, Körperwasser, Viszeralfett, Eiweiß, Grundumsatz, Körperbewertung, Körperalter, Puls oder Taille anzeigen – für alle sichtbaren Personen, mit geglätteter Linie, Zeitraum und „Veränderung“. Angeboten werden nur Werte, für die es Messungen gibt; die Auswahl bleibt gespeichert.

## [2.12.0] – 2026-10-14

### Neu
- **Einstellungen hinter dem Zahnrad** oben rechts, für alle: *Persönlich* (Benachrichtigungen, KI-Hinweise, „Wer darf mich sehen“, Daten exportieren und importieren) und für Admins *Verwaltung* (Waage, Sensoren, KI, Personen, Kinder, Haustiere, Freigaben, HA-Sensoren).
- **„Wer darf mich sehen“:** Jede Person gibt ihre Werte selbst für andere Benutzer frei oder nimmt die Freigabe zurück (bisher nur der Admin).
- **Neuer Tab „Verlauf“** mit dem großen Graphen, den Monatswerten und dem Kalender.
- **„+ Eintragen“** unten rechts: Messung eintragen oder Haustier/Kind wiegen, von jeder Seite aus.
- **Übersicht:** kleiner Verlauf der letzten 30 Tage direkt unter dem Gewicht; Körperwerte als Reiter (Fett und Wasser, Muskeln und Knochen, Stoffwechsel, Herz und Fitness, weitere Kennzahlen).

### Geändert
- Offene Messungen und erkannte Haustier-Wägungen erscheinen in der Übersicht als schmale Leiste zum Aufklappen statt als große Karten (im Tab *Messungen* weiterhin ausgeklappt).
- *Meine Daten* enthält nur noch Profil und Ziel; Benachrichtigungen und KI sind in die Einstellungen gewandert, Kalender in den Verlauf, die doppelte Körperkarte entfällt.
- Import/Export ist von *Messungen* in die Einstellungen gewandert.
- Auf dem Handy passen alle Tabs in eine Zeile.

## [2.11.0] – 2026-10-14

### Neu
- **Bewertung unter jedem Wert** der Übersicht, damit man ihn einordnen kann:
  - Körperwerte: Fettmasse, Wassermenge, fettfreie Masse (über den Fettfreie-Masse-Index), Grundumsatz nach Katch-McArdle (im Vergleich zum Durchschnitt), Herzfrequenzreserve (nach Ruhepuls), VO₂max (nach Alter und Geschlecht: Niedrig bis Sehr gut), Ponderal-Index, Körperoberfläche (unter/über Durchschnitt), Impedanz-Index.
  - Werte ohne gut oder schlecht (Grundumsatz nach Mifflin-St Jeor, Gesamtumsatz, maximale Herzfrequenz) sind als „Richtwert“ markiert; beim Idealgewicht nach Broca steht, wo du liegst („Du: +16,3 kg“).
  - Kopf: Trend mit BMI-Einstufung, Veränderungen und Tempo im Verhältnis zum Ziel („Gesundes Tempo“, „Sehr schnell“ über 1 % pro Woche, „Weg vom Ziel“, „Stabil“).
  - Körperbewertung: Gut, Normal, Niedrig, Sehr niedrig.
- Die KI bekommt diese Bewertungen ebenfalls mit (soweit der Wert freigegeben ist).

### Geändert
- „Standard“ heißt in den Bewertungen jetzt „Normal“; die Wassermenge in Litern heißt „Wassermenge“.

## [2.10.0] – 2026-10-14

### Neu
- **Sensoren der Waage nachträglich übernehmen:** Hat das Gerät der Waage passende Sensoren, die noch nicht eingetragen sind (Herzfrequenz, Stabilisiert, zweite Impedanz), zeigt *Einstellungen → Sensoren der Waage* sie mit „Übernehmen und speichern“ an. Bisher kam der Vorschlag nur beim Neu-Auswählen des Gewichtssensors.
- **Fehlende Werte aus dem Verlauf:** Wird ein Sensor der Waage später eingetragen, holt die Integration seine Werte für die Messungen der letzten 30 Tage aus dem Home-Assistant-Verlauf (Wert innerhalb von 2 Minuten um die Messung). So erscheinen Puls und Pulszonen sofort.
- Die Übersicht sagt, warum der Puls fehlt (kein Herzfrequenz-Sensor eingetragen bzw. noch keine Messung mit Puls).

### Behoben
- Änderungen unter *Sensoren der Waage* wurden beim Speichern wieder überschrieben: Jede Einstellungskarte hielt eine Kopie aller Einstellungen, und die Karte „KI-Hinweise“ setzte beim Speichern die alten Werte zurück (z. B. einen gerade eingetragenen Herzfrequenz-Sensor). Jetzt liefert jede Karte nur ihre eigenen Felder.

## [2.9.0] – 2026-10-13

### Geändert
- **Körpertyp als Karte aus BMI und Körperfettanteil** (wie in den Waagen-Apps): zehn Felder von „Mager“ über „Fit“ bis „Fettleibig“, darunter „Unsichtbar fettleibig“ für normales Gewicht mit viel Fett; das eigene Feld ist hervorgehoben, ein Punkt zeigt die genaue Lage. Ersetzt die 3×3-Matrix aus Fett und Muskeln.
- **Werte als HA-Sensoren:** Auswählbar ist nur noch, was sich auch berechnen lässt – passend zu den Sensoren der Waage und den Angaben der Person. Nicht verfügbare Werte stehen gesammelt darunter mit der fehlenden Angabe (z. B. „Braucht Geburtsmonat, Geschlecht: …“). „Alle“ wählt nur verfügbare Werte. Home Assistant legt solche Sensoren auch nicht mehr an.

### Behoben
- Sensoren ließen sich im Panel nicht an- oder abwählen („expected str at 'id'“): Das Feld für die Person hieß `id` und wurde von der Nachrichtennummer der Verbindung überschrieben.

## [2.8.0] – 2026-10-13

### Neu
- **Weitere Kennzahlen** aus Gewicht, Größe, Alter, Puls und Impedanz, in der Übersicht und als HA-Sensoren: Ponderal-Index, Körperoberfläche (Mosteller), Idealgewicht (Broca), Grundumsatz nach Mifflin-St Jeor und nach Katch-McArdle, Gesamtumsatz, maximale Herzfrequenz (Tanaka), Herzfrequenzreserve, Pulszonen (Gesundheit, Fettverbrennung, aerob, anaerob), geschätzte VO₂max, Impedanz-Index, Fettmasse, fettfreie Masse und Körperwasser in Litern.
- **Formel für die Körperzusammensetzung wählbar** (Einstellungen → Sensoren der Waage): Standard oder Sun et al. 2003.
- **Aktivitätslevel** unter *Meine Daten* (sitzend bis extrem aktiv) für den Gesamtumsatz.
- Neue Sensoren sind bei Personen, die schon Körpersensoren nutzen, einmalig vorausgewählt.
- KI: Aktivitätslevel, Gesamtumsatz und VO₂max lassen sich ebenfalls freigeben.

### Geändert
- Erklärungen sagen schlicht, was ein Wert bedeutet, ohne Herkunftsangaben.
- Die Erklärungs-Popups sind schlichter: abgerundet, ohne Rahmen, Schließen mit ×.
- Werte, die nur Gewicht, Größe und Alter brauchen, gibt es auch ohne Impedanz-Waage.

### Behoben
- Die Erklärungs-Popups hatten keine Gestaltung (eckig, Standard-Rahmen), weil eine übrig gebliebene CSS-Zeile ihre Regel unwirksam machte.

## [2.7.0] – 2026-10-13

### Geändert
- **Übersicht aufgeräumt**, Aufbau unverändert:
  - Statt (i)-Symbolen ist die Beschriftung jedes Werts selbst antippbar (gepunktete Unterlinie) und öffnet die Erklärung.
  - Bewertungen sind ruhiger: „Standard“ und „Gut“ erscheinen grau mit grünem Punkt, farbig ist nur, was auffällt.
  - Kopf mit vier Kennzahlen in einer Reihe; „seit Beginn“ steht in der Ziel-Zeile, Min/Max entfällt.
  - Die Kacheln stehen in einer Karte „Körperwerte“, gruppiert nach Fett und Wasser, Muskeln und Knochen, Stoffwechsel und Herz.
  - Körpertyp und Vorschläge zum Gewicht teilen sich eine Karte; die Übersicht hat höchstens zwei Spalten, damit Karten paarweise stehen.

## [2.6.1] – 2026-10-13

### Behoben
- Einstellungen: Die Listen der Personen, Kinder, Haustiere und „Werte als HA-Sensoren“ wurden verzerrt dargestellt (kursive Ovale, überlappende Häkchen). Die neuen Infoknöpfe hatten denselben CSS-Klassennamen wie diese Listen.

## [2.6.0] – 2026-10-13

### Neu
- **Infoknopf (i) an jedem Wert** der Übersicht: Erklärung, wie der Wert entsteht, was er bedeutet und welcher Bereich normal ist; beim Körperfett mit dem persönlichen Standardbereich.
- **Körperzusammensetzung als Figur:** männliche oder weibliche Silhouette (nach dem eingetragenen Geschlecht), gefüllt mit Bändern für Muskelgewebe, essentielles Fett, Speicherfett, Knochen und Sonstiges, jeweils so hoch wie ihr Anteil; daneben Legende mit Prozent und kg.
- **KI: Werte selbst auswählen.** Unter *Meine Daten → KI-Hinweise* legt jede Person einzeln fest, welche Werte an die KI gehen (Profil, Gewicht, Körperwerte; *Alle*/*Keine*).
- **Umschalter in der Übersicht mit Kindern und Haustieren:** alle Personen, Kinder und Tiere, die man sehen darf.

### Geändert
- Kinder und Haustiere stehen nicht mehr als eigener Abschnitt unter der Übersicht, sondern im Umschalter.

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
