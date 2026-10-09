# Weight Tracker für Home Assistant

Custom Integration, die die Messwerte **einer** Waage automatisch den richtigen Personen zuordnet und pro Person Gewicht, Trend, Veränderungen, BMI und Zielprognose als Sensoren bereitstellt. Ein eigenes Panel **„Gewicht“ in der Seitenleiste** zeigt alles auf einen Blick – ohne Dashboard-Konfiguration.

## Installation

1. Den Ordner `custom_components/weight_tracker` nach `/config/custom_components/weight_tracker` kopieren (z. B. per Samba, File-Editor oder Studio Code Server).
   Alternativ über HACS: ⋮ → *Benutzerdefinierte Repositories* → `https://github.com/Ga-Re/HAWeightTracker`, Typ „Integration“. Danach „Weight Tracker“ herunterladen.
2. Home Assistant neu starten.
3. **Einstellungen → Geräte & Dienste → Integration hinzufügen → „Weight Tracker“**: einen Namen vergeben und den Gewichtssensor der Waage wählen. Das ist der Sensor, der beim Wiegen den neuen Wert bekommt.
4. In der Seitenleiste **Gewicht → Einstellungen** öffnen und die Personen anlegen. Alles Weitere stellst du dort ein.

Voraussetzung: Home Assistant **2025.3** oder neuer. Das Integrations-Icon aus dem Ordner `brand/` zeigt Home Assistant erst ab **2026.3** an.

Auf dem Home Assistant muss danach genau diese Struktur liegen. Wichtig ist der Unterordner `frontend`, ohne ihn gibt es kein Panel:

```
/config/custom_components/weight_tracker/
├── __init__.py, access.py, analytics.py, button.py, config_flow.py, const.py,
│   body.py, detector.py, entity.py, manager.py, milestones.py, notifications.py, panel.py, pets.py,
│   sensor.py, services.py, settings.py
├── manifest.json, icons.json, services.yaml
├── brand/
│   ├── icon.png
│   └── icon@2x.png
├── frontend/
│   ├── weight-tracker-card.js
│   └── weight-tracker-panel.js
└── translations/
    ├── de.json
    └── en.json
```

Nach der Einrichtung erscheint in der Seitenleiste der Eintrag **Gewicht** (bzw. *Weight* bei englischer Oberfläche).

## Das Panel „Gewicht“

Das Panel hat drei Tabs. Der dritte heißt für Admins „Einstellungen“ und für alle anderen „Meine Daten“.

### Übersicht
- **Offene Messungen** stehen ganz oben. Ein Klick auf den Namen ordnet die Messung zu.
- **Eine Karte pro Person** zeigt aktuelles Gewicht, Trend, Veränderung über 7 und 30 Tage und insgesamt, Tempo pro Woche, BMI und Alter. Mit Zielgewicht kommen ein Fortschrittsbalken und das voraussichtliche Datum dazu.
  - Sind für die Person Sensoren angelegt, öffnet ein Klick auf einen Wert die gewohnte Entitätsansicht von Home Assistant mit Verlauf.
- **Verlauf als Graph:** Jede Messung ist ein Punkt, dazu kommt die geglättete Trendlinie und das Zielgewicht als gestrichelte Linie. Zeiträume: 30 Tage, 90 Tage, 1 Jahr, alles. Mit *Veränderung* starten alle Personen bei 0, das ist praktisch für den Vergleich. Personen lassen sich ein- und ausblenden, beim Überfahren zeigt ein Tooltip die Details.
- **Monatsdurchschnitt** pro Person mit Veränderung zum Vormonat.

### Messungen
- **Messliste** mit Filter pro Person. Die Person kann direkt umgestellt oder die Messung gelöscht werden.
- **Messung eintragen** für manuelle Werte oder alte Daten.

### Meine Daten
Jeder, der mit einer Person verknüpft ist (auch Admins), hat hier seine eigene Seite:
- **Kacheln** mit Alter, Größe, BMI und Ziel.
- **Gesunder Bereich:** BMI-Skala mit deiner Position und dem Normalgewicht für deine Größe.
- **Dein Ziel:** Fortschritt, Tempo und voraussichtliches Datum.
- **Bearbeiten:** Ein Klick auf den Stift ✎ in den Kacheln Alter (Geburtsmonat/-jahr), Größe oder Ziel öffnet das Feld direkt in der Kachel. BMI und Gesunder Bereich rechnen schon beim Tippen mit.

Vor jedem Namen steht das **Bild der Home-Assistant-Person**. Es stammt von der gewählten Anwesenheits-Entität (`person.*`) oder, falls keine gewählt ist, von der Person des verknüpften Benutzers. Ein Ring in der Personenfarbe zeigt die Zuordnung zum Graphen. Ohne Bild erscheint die Initiale.

### Einstellungen (nur Admins)
- **Waage:** Name, Gewichtssensor, minimales und maximales Gewicht, Toleranz, Eindeutigkeits-Abstand und Wartezeit, bis ein Wert stabil ist.
- **Personen:** anlegen, bearbeiten und löschen. Pro Person gibt es Name, Startgewicht, Größe, Zielgewicht, Geburtsmonat, Anwesenheits-Entität, verknüpften HA-Benutzer, wer zusätzlich ansehen darf und ob Sensoren angelegt werden. Beim Löschen einer Person werden auch ihre Messungen gelöscht.
- **Freigaben:** Tabelle Benutzer × Personen, siehe unten.

Die Formulare nutzen die Eingabefelder von Home Assistant selbst. Waagen-Sensor und Anwesenheit sind durchsuchbare Entitätsauswahlen mit Filter: Gewichtssensoren bzw. nur `person.*`-Entitäten. Speichern lädt die Integration kurz neu, das Panel aktualisiert sich dabei von selbst. Der Knopf *Konfigurieren* unter Geräte & Dienste verweist nur noch auf das Panel.

Das Panel passt sich dem hellen oder dunklen Theme an, funktioniert auf dem Handy und lädt nichts aus dem Internet. Die Daten kommen live über die WebSocket-Verbindung von Home Assistant.

## Auswertung

- **Prognose im Graph:** Mit Zielgewicht verlängert eine gestrichelte Linie den Trend bis zum voraussichtlichen Datum, eine Linie markiert „Heute“. Ein- und ausschaltbar über *📈 Prognose*.
- **Kalender** (unter *Meine Daten*): ein Jahr auf einen Blick, ein Kästchen pro Tag. Blau: Trend in Richtung Ziel, Rot: weg vom Ziel, Grau: kaum Veränderung, leer: nicht gewogen. Dazu Messtage und längste Serie.
- **CSV-Export und -Import** (unter *Messungen*): Export aller sichtbaren Messungen als CSV. Der Import übernimmt alte Daten aus anderen Apps (Withings, Zepp/Mi Fit, Garmin oder eigene Tabellen). Spalten, Trennzeichen, Datumsformat, Pfund und Körperfett (in % oder kg) werden erkannt. Vor dem Import zeigt eine Vorschau, was übernommen wird, Duplikate werden übersprungen. Ein Import löst keine Erfolgs-Benachrichtigungen aus.
- **Dashboard-Karte:** In jedem Dashboard gibt es in der Kartenauswahl die Karte **Weight Tracker**. Sie zeigt Gewicht, Trend, Ziel und Verlauf von dir selbst, einer anderen Person oder einem Haustier, jeweils nur soweit freigegeben. Eine manuelle Ressource ist nicht nötig. Ein Klick öffnet das Panel.

```yaml
type: custom:weight-tracker-card
person: Mimi        # optional, leer = du selbst
chart_days: 90      # optional, 0 = ohne Verlauf
```

## Körperdaten

- **Geschlecht, Größe, Geburtsmonat, Ziel** und **Taillenumfang** pflegt jede Person selbst unter *Meine Daten* (Stift ✎ in den Kacheln). Aus Taille und Größe wird das Taille-zu-Größe-Verhältnis (WHtR) berechnet und eingestuft. Es ist aussagekräftiger als der BMI allein.
- **Körperzusammensetzung (nur wenn die Waage sie liefert):** Unter *Einstellungen → Waage* lassen sich optional ein **Impedanz-Sensor** (z. B. Xiaomi Body Composition Scale) oder ein **Körperfett-Sensor** auswählen. Ist ein Wert beim Wiegen frisch (höchstens 2 Minuten alt), wird er mit der Messung gespeichert.
  - Aus der Impedanz werden Körperfett, Muskelmasse, Körperwasser, Knochenmasse und Grundumsatz geschätzt (Xiaomi-Formel wie in openScale/bodymiscale). Das sind Richtwerte, keine medizinische Messung. Dafür braucht es Geschlecht, Geburtsmonat und Größe, fehlende Angaben nennt das Panel.
  - Ohne diese Sensoren erscheint nirgends etwas zur Körperzusammensetzung.
  - Mit *Sensoren in HA* gibt es zusätzlich die Sensoren Körperfett, Muskelmasse, Körperwasser, Knochenmasse und Grundumsatz.
- **Notizen zu Messungen** („Urlaub“, „krank“, „neues Training“): beim Eintragen oder über 📝 in der Messliste. Im Graph sind Messungen mit Notiz umrandet, der Tooltip zeigt die Notiz.

## Benachrichtigungen & Erfolge

Jede Person entscheidet unter **Meine Daten → Benachrichtigungen** selbst, ob und welche Nachrichten sie bekommt. Die Nachrichten gehen nur an das Gerät, das sie dort auswählt (ein `notify`-Dienst, z. B. die Home-Assistant-App auf ihrem Handy):
- **Nach dem Wiegen:** Gewicht, Veränderung seit der letzten Messung und Trend der letzten 7 Tage. Bei einem neuen Bestwert kommt ein 🎉 dazu.
- **Erfolge und Serien:** z. B. „Du hast 5 kg abgenommen“, „Zielgewicht erreicht“, „14 Tage in Folge gewogen“, „100. Messung“.
- **Erinnerung:** nach einer selbst gewählten Zahl von Tagen ohne Messung, jeweils um 18 Uhr.
- **Testnachricht** zum Ausprobieren.

Erfolge zählen über den Trend, damit Tagesschwankungen kein Abzeichen auslösen. Sie erscheinen unter *Meine Daten* als Abzeichen, zusammen mit der aktuellen Serie und dem nächsten Ziel („noch 1,2 kg bis −7,5 kg“). Bereits erreichte Erfolge werden beim Update still übernommen, es gibt also keine Nachrichtenflut.

## Haustiere wiegen

Haustiere werden per **Differenzmessung** gewogen: einmal allein auf die Waage, einmal mit dem Tier auf dem Arm. Die Differenz ist das Gewicht des Tiers. Die Messung „allein“ zählt ganz normal für dich, die Messung „mit Tier“ wird dir nie zugerechnet.

- **Per Knopf:** In der Übersicht hat jedes Haustier einen Knopf **„Mimi wiegen“**. Danach werden die nächsten zwei Messungen innerhalb von 3 Minuten gepaart, die Reihenfolge ist egal. Dieselbe Funktion gibt es als Taste `button.mimi_weigh` (z. B. für ein NFC-Tag an der Waage) und als Aktion `weight_tracker.weigh_pet`.
- **Automatisch:** Wiegst du dich zweimal innerhalb von 3 Minuten und passt der Unterschied zu einem deiner Haustiere, fragt das Panel: *„War das eine Haustier-Messung?“*. Du bestätigst oder tippst *„Nein, das war ich“*. Zwei verschiedene Personen hintereinander oder eine Jacke (+1 kg) lösen keinen Vorschlag aus.
- **Haustiere anlegen** (Admins): Einstellungen → Haustiere, mit Name, Tierart, ungefährem Gewicht, optionalem Ziel, Geburtsmonat und Sensoren.
- **Sichtbarkeit:** Haustiere gehören zum Haushalt. Alle Benutzer sehen sie und dürfen sie wiegen. Wer ein Tier getragen hat, sieht man nur, wenn man diese Person sehen darf.
- Haustier-Messungen lassen sich unter *Messungen* einem anderen Tier zuordnen oder löschen (Admins und die Person, die das Tier getragen hat). Über *Messung eintragen* kannst du ein Gewicht auch von Hand eintragen.

Genauigkeit: Viele Personenwaagen messen auf 0,1 kg genau, die Differenz kann also um etwa ±0,2 kg schwanken. Der Trend gleicht das über mehrere Messungen aus.

## Datenschutz & Freigaben

Jede Person sieht standardmäßig **nur ihre eigenen Daten**.

| Rolle | sieht | darf |
|---|---|---|
| **Admin** | alle Personen und alle Messungen | alles: zuordnen, verwerfen, löschen, eintragen, Freigaben ändern |
| **Die Person selbst** (verknüpfter HA-Benutzer) | eigene Daten und offene Messungen, die zum eigenen Gewicht passen | offene Messungen übernehmen („Das war ich“), eigene Messungen eintragen und löschen, „Nicht ich“ (zurück zu offen), Größe, Zielgewicht und Geburtsmonat ändern |
| **Freigegebener Benutzer** | die freigegebene Person | nur ansehen |
| **Alle anderen** | nichts | nichts |

**Einstellen:** Im Panel **Gewicht → Einstellungen** steht die Karte **🔒 Freigaben**: eine Tabelle mit den Benutzern als Zeilen und den Personen als Spalten. Für jede Zelle wählst du *kein Zugriff*, *darf ansehen* oder *ist diese Person*. Änderungen gelten sofort. Dieselben Angaben lassen sich auch beim Bearbeiten einer Person setzen.

So ist die Privatsphäre abgesichert:
- Der Server schickt jedem Benutzer nur die Daten, die er sehen darf. Es wird nicht bloß im Browser ausgeblendet.
- Die Aktionen (`weight_tracker.*`) prüfen den aufrufenden Benutzer. Über die Entwicklerwerkzeuge kann niemand fremde Messungen ändern. Automationen und Skripte laufen ohne Benutzer und dürfen alles.
- Offene Messungen sehen Nicht-Admins nur, wenn das Gewicht zu ihnen passen könnte. So erfährt niemand das Gewicht der anderen Person.
- Die Benachrichtigung über offene Messungen enthält keine Gewichte, weil Benachrichtigungen in Home Assistant alle Benutzer sehen.

**Wichtig – Grenzen von Home Assistant:**
- **Sensoren sind für alle Benutzer sichtbar.** Home Assistant kennt keine Rechte pro Entität. Personen-Sensoren sind deshalb standardmäßig **aus** und lassen sich pro Person in der Freigabe-Tabelle unter *Sensoren in HA* einschalten. Das ist nur nötig, wenn du die Werte für Automationen brauchst.
- **Der Sensor deiner Waage selbst** (aus der Integration der Waage) zeigt allen Benutzern den letzten Rohwert, allerdings ohne Namen. Das kann diese Integration nicht verhindern.
- Admins sehen in Home Assistant grundsätzlich alles. Gib deiner Partnerin bzw. dir selbst deshalb ein normales Benutzerkonto, wenn die Trennung in beide Richtungen gelten soll.

## So funktioniert die Erkennung

Wenn der Waagen-Sensor einen neuen Wert meldet:

1. **Zwischenwerte abwarten.** Gespeichert wird erst, wenn der Wert ein paar Sekunden stabil ist (Standard 5 s).
2. **Unplausibles ignorieren.** Werte außerhalb von min/max (Standard 30–250 kg), doppelte Meldungen innerhalb von 10 Minuten und der alte Wert nach einem Neustart werden ignoriert.
3. **Person bestimmen.** Jede Person hat ein Referenzgewicht (Trendgewicht und letzte Messung, anfangs das Startgewicht):
   - Liegt nur **eine** Person innerhalb der Toleranz (Standard ±3 kg, plus 0,15 kg pro Tag seit der letzten Messung), bekommt sie die Messung.
   - Passen **mehrere** und ist nur eine davon zu Hause (wenn `person.*` hinterlegt ist), gewinnt diese.
   - Sonst gewinnt die nächste Person, wenn sie mindestens 1 kg näher liegt als die zweitnächste.
   - Andernfalls wird die Messung als **offen** markiert. Es erscheint eine Benachrichtigung, und im Panel ordnet man die Messung mit einem Klick zu.

Wurde falsch zugeordnet, stellst du es in der Messliste des Panels richtig. Die Statistiken werden sofort neu berechnet.

## Entitäten

Personen-Sensoren werden nur angelegt, wenn *Sensoren in HA* für die Person eingeschaltet ist (siehe oben, sie sind dann für alle Benutzer sichtbar). Die Entitäts-IDs sind unabhängig von der Sprache (Beispiel: Person „Anna“, Waage „Waage“).

| Entität | Bedeutung |
|---|---|
| `sensor.anna_weight` | zuletzt gemessenes Gewicht (Attribute: min/max/erste Messung/Anzahl) |
| `sensor.anna_trend` | geglättetes Gewicht. Gleicht Wasser- und Tagesschwankungen aus (10 % pro Tag, wie in „The Hacker's Diet“) |
| `sensor.anna_change_last` | Differenz zur vorherigen Messung |
| `sensor.anna_change_7d` / `_change_30d` | Veränderung des Trends über 7 bzw. 30 Tage |
| `sensor.anna_change_total` | Veränderung seit der ersten Messung |
| `sensor.anna_rate` | Tempo in kg/Woche (lineare Regression über 4 Wochen) |
| `sensor.anna_bmi` | BMI (nur mit Größe) |
| `sensor.anna_goal_distance` / `_goal_eta` | Abstand zum Zielgewicht und voraussichtliches Datum bei aktuellem Tempo (nur mit Ziel) |
| `sensor.anna_last_measured` | Zeitpunkt der letzten Messung |
| `sensor.waage_pending` | Anzahl offener Messungen (immer vorhanden, ohne Gewichte) |

Die Messungen selbst liegen in `/config/.storage/weight_tracker.<id>` und bleiben unabhängig von der Recorder-Aufbewahrung erhalten. Die Gewichts-Sensoren haben `state_class: measurement`, sodass Home Assistant dauerhaft Langzeitstatistiken für die Graphen speichert.

## Aktionen

| Aktion | Zweck |
|---|---|
| `weight_tracker.assign_measurement` | Messung (`measurement_id`, leer = neueste) einer `person` zuordnen. `person: discard` verwirft sie, `person: pending` macht sie wieder offen |
| `weight_tracker.add_measurement` | Gewicht manuell eintragen, optional mit `timestamp`. Damit lassen sich auch alte Daten importieren |
| `weight_tracker.delete_measurement` | Messung löschen |

Bei jeder neuen oder geänderten Messung wird das Event `weight_tracker_measurement` ausgelöst (`person`, `weight`, `status`, `method`, `measurement_id`).

### Beispiel: Rückfrage per Handy bei unklaren Messungen

Die Nachricht enthält das Gewicht. Schick sie also nur an ein Handy, dessen Besitzer alle Daten sehen darf (z. B. das des Admins).

```yaml
automation:
  - alias: Waage – unklare Messung nachfragen
    triggers:
      - trigger: event
        event_type: weight_tracker_measurement
        event_data:
          status: pending
    actions:
      - action: notify.mobile_app_dein_handy
        data:
          title: "Wer stand auf der Waage?"
          message: "{{ trigger.event.data.weight }} kg"
          data:
            actions:
              - action: "WT_{{ trigger.event.data.measurement_id }}_PERSON A"
                title: "PERSON A"
              - action: "WT_{{ trigger.event.data.measurement_id }}_PERSON B"
                title: "PERSON B"

  - alias: Waage – Antwort übernehmen
    triggers:
      - trigger: event
        event_type: mobile_app_notification_action
    conditions:
      - "{{ trigger.event.data.action.startswith('WT_') }}"
    actions:
      - action: weight_tracker.assign_measurement
        data:
          measurement_id: "{{ trigger.event.data.action.split('_')[1] }}"
          person: "{{ trigger.event.data.action.split('_', 2)[2] }}"
```

## Fehlersuche

**Kein Logo in der Updates-Liste:** Die Updates-Liste zeigt das Bild der HACS-Update-Entität. HACS verweist dafür noch auf das alte Brands-CDN und kennt den `brand/`-Ordner nicht, den Home Assistant seit 2026.3 nutzt. Unter Geräte & Dienste erscheint das Icon trotzdem. Für die Updates-Liste gibt es einen Umweg: Die Integration stellt ihr Icon unter `/weight_tracker_brand/icon.png` bereit. Trag in der `configuration.yaml` Folgendes ein und starte neu (den Entitätsnamen findest du unter Einstellungen → Entitäten, Suche „Weight Tracker update“):

```yaml
homeassistant:
  customize:
    update.weight_tracker_update:
      entity_picture: /weight_tracker_brand/icon.png
```

**„Unable to load custom panel from …/weight-tracker-panel.js“**: Home Assistant findet die Panel-Datei nicht.
1. Prüfe, ob `/config/custom_components/weight_tracker/frontend/weight-tracker-panel.js` existiert, z. B. im File-Editor oder in Studio Code Server.
2. Ruf im Browser `http://<home-assistant>:8123/weight_tracker_static/weight-tracker-panel.js` auf. Dort muss JavaScript-Code erscheinen, keine 404-Fehlerseite.
3. Starte Home Assistant nach dem Kopieren neu. Ein Neuladen der Integration reicht nicht, weil das Panel beim Start angemeldet wird.
4. Lade die Seite im Browser einmal hart neu (Strg/Cmd + Shift + R). In der Companion-App: Einstellungen → Companion App → Fehlerbehebung → Frontend-Cache zurücksetzen.

Seit Version 1.2.0 meldet die Integration eine fehlende Datei selbst als Benachrichtigung und im Log.

## Grenzen

- Meldet die Waage zweimal hintereinander **exakt** denselben Wert, löst Home Assistant keine Zustandsänderung aus. Die zweite Messung wird dann nicht erfasst.
- Wiegt ihr ungefähr gleich viel (weniger als ~1 kg Unterschied), entscheidet nur die Anwesenheit. Ohne `person.*`-Entität fragt die Integration nach.

## Lizenz

[MIT](LICENSE)
