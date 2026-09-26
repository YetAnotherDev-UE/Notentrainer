/* book.js: das Handbuch im Spiel. Ein aufgeschlagenes Buch mit Lesezeichen
 * links, ein Kapitel je Modus und je Musikthema (Noten lesen, Notenwerte,
 * Vorzeichen, Tonleitern, Intervalle, Stücke, Abenteuer, Technik, Begriffe).
 * Die Bilder zeichnet der Notenzeichner selbst auf kleine Canvases
 * (data-fig), eine Figur ist animiert (der Lauf). Texte sind Daten, jede
 * Seite ein HTML-Stück; app.js schaltet den Bildschirm nur ein und aus. */
"use strict";
window.NT = window.NT || {};

NT.book = (() => {
  const $ = id => document.getElementById(id);
  const N = NT.notation, MU = NT.music;
  let settings = null;
  const B = { chapter: "start", page: 0, anim: null, rafId: 0, ro: null };
  const naming = () => (settings && settings.naming) || "de";
  const nm = midi => MU.name(midi, naming());

  /* --- Bausteine fuer die Seiten --------------------------------------- */
  const fig = (kind, h, cap) => `<div class="fig" style="height:${h || 150}px"><canvas data-fig="${kind}"></canvas></div>${cap ? `<p class="figCap">${cap}</p>` : ""}`;
  const tip = text => `<div class="tipbox">${text}</div>`;
  const dl = items => `<dl class="gloss">${items.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl>`;

  /* --- Kapitel ---------------------------------------------------------- */
  const CHAPTERS = [
    { id: "start", tab: "Start", icon: "★", colors: ["#ffe066", "#f0b400"], title: "Willkommen", pages: [
      `<div class="ribbon display">Willkommen</div>
       <p>Der Notentrainer übt eine Sache: <b>Noten sehen, die richtige Taste treffen</b>, immer flüssiger. Das Piano ist per MIDI angeschlossen (die Datenverbindung, über die der Rechner jede Taste mitbekommt, mehr im Kapitel „Technik“), jede Taste wird sofort geprüft.</p>
       <p>Es gibt zwei Wege:</p>
       <ul><li><b>Abenteuer</b>: eine Karte mit Welten und Levels, von zwei Tönen bis zum ganzen Stück. Jedes Level bringt seine Regeln mit, du musst nichts einstellen.</li>
       <li><b>Frei üben</b>: die Modi einzeln, mit deinen Einstellungen (Schlüssel, Umfang, Tempo).</li></ul>
       <h3>Die Modi in einem Satz</h3>
       <ul><li><b>Einzeln</b>: eine Note steht, du hast Zeit.</li><li><b>Lauf</b>: Noten kommen von rechts, triff sie an der roten Linie.</li><li><b>Intervalle</b>: lies die Bewegung von Note zu Note.</li><li><b>Rhythmus</b>: nur der Zeitpunkt zählt, jede Taste.</li><li><b>Stücke</b>: kurze Ausschnitte aus echten Stücken.</li><li><b>Tonleiter</b>: alle Töne einer Tonart rauf und runter.</li><li><b>Gehör</b>: Ton hören, Taste finden.</li><li><b>Quiz</b>: Fragen antippen, ganz ohne Klavier.</li></ul>
       <p>Dieses Handbuch erklärt jeden Modus und die Musik dahinter, von vorn nach hinten aufgebaut. Unklares Wort? Das letzte Lesezeichen <b>Begriffe</b> erklärt alle kurz.</p>`,
      `<h3>Der Spielbildschirm</h3>
       <div class="shot"><div class="hud mini"><div class="hudItem c1"><b class="display">12</b><span>Serie</span></div><div class="hudItem c3"><b class="display">×2</b><span>Multi</span></div><div class="hudItem c4"><b class="display">94 %</b><span>Treffer</span></div><div class="hudItem c2"><b class="display">+240</b><span>XP</span></div></div></div>
       <ul><li><b>Serie</b>: Treffer in Folge. Ein Fehler setzt sie auf null.</li>
       <li><b>Multi</b>: der Multiplikator. Ab 10 in Folge ×2, ab 20 ×3, ab 30 ×4.</li>
       <li><b>Treffer</b>: die Quote, also der Anteil richtiger Antworten in dieser Runde.</li>
       <li><b>XP</b>: Erfahrungspunkte. Jeder Treffer bringt 10 XP mal Multi; hier steht, was du gerade verdienst.</li>
       <li>Der Balken darunter zeigt, wie weit die Runde ist.</li>
       <li>Die <b>rote Linie</b> im System ist das Jetzt: dort muss die Note getroffen werden.</li>
       <li>Unten links die <b>Rückmeldung</b>: grün richtig (mit Abweichung in Millisekunden), rot falsch (mit der gespielten und der gesuchten Note).</li>
       <li>Unten rechts die <b>Chips</b>: gedrückte Tasten und Pedale.</li></ul>
       ${tip("Im Spiel öffnet der Knopf <b>?</b> oben rechts das passende Kapitel, auf der Level-Karte der Knopf <b>Erklärung</b>.")}`,
      `<h3>XP und Level</h3>
       <p>XP sammeln sich über alle Runden. Mit ihnen steigt dein Level: Level 2 ab 100 XP, Level 3 ab 283, Level 5 ab 800, Level 10 ab 2700. Im Abenteuer gibt es Bonus-XP je Stern.</p>
       <h3>Die Heute-Karte</h3>
       <ul><li><b>Tagesziel</b>: Noten je Tag als Ring (Einstellungen, 0 schaltet es aus).</li>
       <li><b>Serie</b>: Tage in Folge mit mindestens 20 Noten. Heute darf noch offen sein.</li>
       <li><b>Empfehlung</b>: die schwächste Note der letzten Zeit, ein Tempo-Hinweis oder das nächste Level, mit Startknopf.</li>
       <li><b>Aufwärmen</b>: drei Runden hintereinander: eine Tonleiter, ein Lauf um die schwache Stelle, Ausschnitte aus Stücken.</li></ul>
       <h3>Statistik</h3>
       <p>Diagramme (Trefferquote, Noten je Tag, Abweichung, Reaktionszeit, XP, Serie, zu früh oder zu spät), jede Note mit Quote, alle Sitzungen.</p>
       ${tip("Alles liegt nur in diesem Browser. <b>Exportieren</b> in der Statistik sichert den Verlauf als Datei, <b>Importieren</b> holt ihn auf ein anderes Gerät.")}`,
    ] },

    { id: "noten", tab: "Noten", icon: "𝄞", colors: ["#5ee2ff", "#0ea5c9"], title: "Noten lesen", pages: [
      `<div class="ribbon display">Noten lesen</div>
       <h3>Töne und ihre Namen</h3>
       <p>Die weißen Tasten heißen <b>C D E F G A H</b>, dann geht es wieder mit C weiter. Von einem C zum nächsten ist eine <b>Oktave</b>: sieben weiße Tasten. Damit klar ist, welches C gemeint ist, bekommt jeder Ton eine Zahl: <b>C4</b> ist das mittlere C in der Klaviermitte, C5 eine Oktave höher, C3 eine tiefer.</p>
       ${fig("keyboard", 115, "Eine Oktave auf der Klaviatur, von C4 bis C5.")}
       <p>Deutsch heißt der siebte Ton <b>H</b>, international <b>B</b>. Das erniedrigte H heißt auf Deutsch <b>B</b> (dazu mehr im Kapitel „Vorzeichen“). In den Einstellungen lässt sich die Schreibweise umstellen.</p>
       ${tip("Die schwarzen Tasten heißen Cis, Des und so weiter; sie kommen im Kapitel „Vorzeichen“ dran.")}`,
      `<h3>Das Notensystem</h3>
       <p>Fünf Linien, vier Zwischenräume. Jede Linie und jeder Raum steht für einen Ton, also für eine weiße Taste. Je höher die Note im System, desto höher der Ton. Nachbarpositionen sind Nachbartöne: von einer Linie in den Raum darüber ist ein Ton weiter.</p>
       ${fig("treble", 170, "Violinschlüssel: die Töne von C4 bis C5. C4 hängt an einer kleinen Hilfslinie unter dem System.")}
       <p>Welcher Ton auf welcher Linie liegt, legt der <b>Schlüssel</b> am Anfang fest. Der <b>Violinschlüssel</b> (G-Schlüssel) kringelt sich um die zweite Linie von unten: das ist <b>G4</b>. Linien von unten: E G H D F, Merkhilfe „Es Geht Hurtig Durch Fleiß“. Zwischenräume: F A C E.</p>`,
      `<h3>Der Bassschlüssel</h3>
       <p>Für tiefe Töne gibt es einen zweiten Schlüssel. Die beiden Punkte umschließen die vierte Linie von unten: das ist <b>F3</b>. Linien: G H D F A, Zwischenräume: A C E G.</p>
       ${fig("bass", 170, "Bassschlüssel: C3 bis C4. C4 liegt hier über dem System.")}
       ${tip("Die linke Hand liest meist im Bassschlüssel, die rechte im Violinschlüssel. Beide zusammen ergeben das Klaviersystem, siehe Kapitel „Stücke“.")}`,
      `<h3>Hilfslinien</h3>
       <p>Über und unter dem System geht es mit kurzen Strichen weiter, den <b>Hilfslinien</b>. <b>C4</b> liegt genau zwischen beiden Schlüsseln: eine Hilfslinie unter dem Violinschlüssel, eine über dem Bassschlüssel. Darum heißt es das mittlere C.</p>
       ${fig("ledger", 170, "Hilfslinien unter und über dem Violinschlüssel.")}
       ${tip("Anfängertipp: Merk dir Orientierungstöne, C4 (Hilfslinie), G4 (Kringel), F3 (Punkte), C5 (dritter Raum), und zähl von dort ab. Mit der Zeit kennst du jede Position.")}`,
    ] },

    { id: "rhythmus", tab: "Rhythmus", icon: "♩", colors: ["#f9a8d4", "#be185d"], title: "Notenwerte und Rhythmus", pages: [
      `<div class="ribbon display">Notenwerte</div>
       <p>Die Form der Note sagt, wie lang sie klingt. Gezählt wird in <b>Schlägen</b>: Ein Schlag ist der gleichmäßige Puls, zu dem man mit dem Fuß tippt. Meist ist eine Viertel ein Schlag.</p>
       ${fig("values", 175, "Ganze (4 Schläge), Halbe (2), Viertel (1), Achtel (½), Sechzehntel (¼), punktierte Viertel (1½).")}
       <ul><li><b>Ganze</b>: hohler Kopf ohne Hals, vier Schläge.</li><li><b>Halbe</b>: hohler Kopf mit Hals, zwei Schläge.</li><li><b>Viertel</b>: voller Kopf mit Hals, ein Schlag.</li><li><b>Achtel</b>: dazu ein Fähnchen, ein halber Schlag. <b>Sechzehntel</b>: zwei Fähnchen.</li><li><b>Punkt</b> hinter der Note: die Hälfte länger. Eine punktierte Viertel dauert anderthalb Schläge.</li></ul>
       <p>Ob der Hals nach oben oder unten zeigt, ändert nichts an der Dauer.</p>`,
      `<h3>Takt und Taktart</h3>
       ${fig("time", 150, "Viervierteltakt: vier Schläge je Takt, Taktstriche trennen die Takte.")}
       <p>Senkrechte <b>Taktstriche</b> teilen die Musik in gleich lange Abschnitte, die <b>Takte</b>. Die <b>Taktart</b> am Anfang sagt, wie viele Schläge ein Takt hat: <b>4/4</b> vier Viertel („1 2 3 4“, der Viervierteltakt), <b>3/4</b> drei (Walzer, Menuett), <b>2/4</b> zwei. Die Eins ist der betonte Schlag.</p>
       <h3>Tempo</h3>
       <p>Das Tempo steht in <b>Schlägen pro Minute</b> (bpm). 60 heißt ein Schlag pro Sekunde, 120 zwei. Im Lauf und in den Stücken ist ein Schlag eine Viertel.</p>`,
      `<h3>Pausen</h3>
       ${fig("rests", 140, "Ganze, halbe, Viertel- und Achtelpause.")}
       <p>Für jede Dauer gibt es eine Pause: dann wird nichts gespielt, aber der Takt läuft weiter. Die ganze Pause hängt unter der vierten Linie, die halbe sitzt auf der dritten.</p>
       ${tip("Pausen sind Musik: Wer sie verschluckt, ist beim nächsten Einsatz zu früh.")}`,
      `<h3>Metronom und Einzähler</h3>
       <p>Das <b>Metronom</b> klickt auf jedem Schlag, betont auf der Eins. Der <b>Einzähler</b> zählt einen Takt vor, „1 2 3 4“, die erste Note kommt genau auf die nächste Eins. Beides in den Einstellungen; im Abenteuer schalten die Rhythmus-Level das Metronom selbst.</p>
       <h3>Der Modus Rhythmus</h3>
       <p>Alle Noten liegen auf einer Tonhöhe, jede Taste zählt, nur der <b>Zeitpunkt</b> wird gewertet (±150 ms um die Linie). So übst du Notenwerte, ohne gleichzeitig Tonhöhen lesen zu müssen.</p>
       ${tip("Laut mitzählen hilft: Viertel „1 2 3 4“, Achtel „1 und 2 und“. Eine punktierte Viertel mit Achtel: „1 (2) und“, das Achtel kommt auf das „und“ der Zwei.")}`,
    ] },

    { id: "vorzeichen", tab: "Vorzeichen", icon: "♯", colors: ["#ffe066", "#d97706"], title: "Vorzeichen und Tonarten", pages: [
      `<div class="ribbon display">Vorzeichen</div>
       <p>Zwischen den weißen Tasten liegen die schwarzen. Der Abstand zur nächsten Taste, egal ob schwarz oder weiß, heißt <b>Halbton</b>. Ein <b>Kreuz</b> ♯ vor der Note macht sie einen Halbton höher: die schwarze Taste rechts daneben. Ein <b>B</b> ♭ macht sie einen Halbton tiefer: die schwarze Taste links. Das <b>Auflösungszeichen</b> ♮ hebt beides wieder auf.</p>
       ${fig("accidentals", 160, "Fis (F mit Kreuz), B (H mit B), H (aufgelöst).")}
       <p>Namen: mit Kreuz hängt <b>-is</b> an (Cis, Dis, Fis, Gis, Ais), mit B <b>-es</b> (Des, Es, Ges, As, B).</p>`,
      `<h3>Die schwarzen Tasten</h3>
       ${fig("keyboardBlack", 130, "Die schwarzen Tasten mit beiden Namen.")}
       <p>Dieselbe schwarze Taste hat zwei Namen: Fis und Ges sind dieselbe Taste. Welcher Name gilt, richtet sich nach der <b>Tonart</b>, dem Tonvorrat des Stücks (nächste Seite).</p>
       <p>Ein Vorzeichen vor der Note gilt bis zum <b>Taktende</b> für diese Tonhöhe. Wo keine schwarze Taste dazwischen liegt (E zu F, H zu C), führt ein Kreuz auf die nächste weiße Taste: Eis ist F.</p>`,
      `<h3>Vorzeichnung: die Tonart</h3>
       <p>Jedes Stück benutzt einen festen Vorrat an Tönen, seine <b>Tonart</b>. Sie heißt nach ihrem <b>Grundton</b>, dem Ton, auf dem sie ruht und meist endet. Kreuze oder Bs direkt hinter dem Schlüssel, die <b>Vorzeichnung</b>, gelten für das <b>ganze Stück</b> und in allen Oktaven. G-Dur hat ein Kreuz auf der F-Linie: jedes F wird zum Fis, ohne dass etwas vor der Note steht.</p>
       ${fig("keyG", 150, "G-Dur: ein Kreuz, jedes F ist ein Fis.")}`,
      `<h3>Bs in der Vorzeichnung</h3>
       ${fig("keyF", 150, "F-Dur: ein B, jedes H ist ein B.")}
       <p>Die Kreuze kommen immer in derselben Reihenfolge: <b>F C G D A E H</b>. Die Bs umgekehrt: <b>H E A D G C F</b>. So genügt ein Blick auf die Anzahl.</p>`,
      `<h3>Dur und Moll</h3>
       <table class="tbl"><tr><th>Vorzeichnung</th><th>Dur</th><th>Moll</th></tr>
       <tr><td>keine</td><td>C-Dur</td><td>a-Moll</td></tr><tr><td>1 ♯</td><td>G-Dur</td><td>e-Moll</td></tr><tr><td>2 ♯</td><td>D-Dur</td><td>h-Moll</td></tr><tr><td>3 ♯</td><td>A-Dur</td><td>fis-Moll</td></tr>
       <tr><td>1 ♭</td><td>F-Dur</td><td>d-Moll</td></tr><tr><td>2 ♭</td><td>B-Dur</td><td>g-Moll</td></tr><tr><td>3 ♭</td><td>Es-Dur</td><td>c-Moll</td></tr></table>
       <p>Tonarten gibt es in zwei Klangfarben: <b>Dur</b> klingt hell, <b>Moll</b> dunkler. Jede Vorzeichnung gehört zu einer Dur- und einer Moll-Tonart (parallele Tonarten, der Moll-Grundton liegt drei Halbtöne tiefer). Welche gemeint ist, hört man am Schluss: er endet meist auf dem Grundton.</p>
       <p>Der <b>Quintenzirkel</b> ordnet die Tonarten: Mit jedem Kreuz mehr liegt der Grundton fünf Töne höher (C, G, D, A, E, H), mit jedem B fünf Töne tiefer (C, F, B, Es, As). Der Abstand von fünf Tönen heißt Quinte, dazu das Kapitel „Intervalle“.</p>
       ${tip("Im Spiel: Welt „Schwarze Tasten“ übt Vorzeichen vor der Note, Welt „Tonleitern“ die Vorzeichnung, das Tonarten-Quiz das Erkennen. Frei: Einstellung „Tasten: alle“.")}`,
    ] },

    { id: "tonleitern", tab: "Tonleitern", icon: "↗", colors: ["#5ee8b3", "#12a874"], title: "Tonleitern", pages: [
      `<div class="ribbon display">Tonleitern</div>
       <p>Eine Tonleiter sind alle Töne einer Tonart der Reihe nach, vom Grundton bis zum nächsten Grundton eine Oktave höher. <b>Dur</b> folgt immer demselben Muster aus Ganz- und Halbtonschritten: <b>Ganz Ganz Halb Ganz Ganz Ganz Halb</b>. Ein Halbton ist die nächste Taste (auch schwarz), ein Ganzton zwei Tasten weiter.</p>
       ${fig("scale", 150, "C-Dur aufwärts mit dem Fingersatz der rechten Hand.")}
       <p>C-Dur kommt nur mit weißen Tasten aus. Jede andere Dur-Tonart braucht schwarze Tasten, damit das Muster stimmt: G-Dur das Fis, F-Dur das B.</p>`,
      `<h3>Fingersatz</h3>
       <p>Der <b>Fingersatz</b> sagt, welcher Finger welche Taste nimmt. Ziffern: <b>1</b> Daumen, <b>2</b> Zeigefinger, <b>3</b> Mittelfinger, <b>4</b> Ringfinger, <b>5</b> kleiner Finger, in beiden Händen. Rechte Hand aufwärts: <b>1 2 3 1 2 3 4 5</b>, der Daumen geht unter dem Mittelfinger durch (<b>Daumenuntersatz</b>). Linke Hand aufwärts: <b>5 4 3 2 1 3 2 1</b>. Abwärts jeweils rückwärts.</p>
       ${tip("Der Daumen ist der Schlüssel: Er wandert unter der Hand durch, während der dritte Finger noch spielt. Langsam üben, bis es ohne Ruck geht.")}`,
      `<h3>Moll</h3>
       <p><b>Natürliches Moll</b>: Ganz Halb Ganz Ganz Halb Ganz Ganz. a-Moll braucht nur weiße Tasten, ab A. <b>Harmonisches Moll</b> erhöht den siebten Ton (in a-Moll das G zum Gis): so entsteht ein <b>Leitton</b>, ein Ton, der zum Grundton drängt, und davor ein auffälliger Anderthalbtonschritt.</p>
       <h3>Wozu Tonleitern?</h3>
       <ul><li>Die Tonarten kommen in die Finger: welche schwarzen Tasten wo.</li><li>Der Daumenuntersatz ist die Grundlage für alles, was über fünf Töne hinausgeht.</li><li>Fast jedes Stück besteht aus Ausschnitten von Tonleitern.</li></ul>`,
      `<h3>Der Modus Tonleiter</h3>
       <p>Rauf und wieder runter, im Tempo, mit Vorzeichnung im System. Das Ergebnis zeigt die <b>Gleichmäßigkeit</b>: wie stark die Abstände zwischen den Tönen schwanken (± ms) und wie weit die <b>Anschlagstärke</b> (wie fest du die Tasten drückst) auseinanderliegt. Ziel: alle Töne gleich lang und gleich laut, besonders beim Daumenuntersatz.</p>
       ${tip("Einstellungen: Grundton, Art (Dur, Moll natürlich, Moll harmonisch), eine oder zwei Oktaven. Im Bassschlüssel läuft die Tonleiter eine Oktave tiefer.")}`,
    ] },

    { id: "intervalle", tab: "Intervalle", icon: "↕", colors: ["#2dd4ff", "#1d4ed8"], title: "Intervalle", pages: [
      `<div class="ribbon display">Intervalle</div>
       <p>Ein Intervall ist der Abstand zweier Töne. Gezählt wird nach <b>Buchstaben</b>, beide mitgezählt: C zu D ist eine <b>Sekunde</b> (2), C zu E eine <b>Terz</b> (3), dann Quarte (4), Quinte (5), Sexte (6), Septime (7), und C zum nächsten C die <b>Oktave</b> (8). Derselbe Ton heißt Prime.</p>
       ${fig("intervals", 155, "Sekunde, Terz, Quarte, Quinte, Sexte, Septime, Oktave, jeweils von C4 aus.")}`,
      `<h3>Im System erkennen</h3>
       <ul><li><b>Sekunde</b>: direkt daneben, von der Linie in den Raum oder umgekehrt.</li><li><b>Terz</b>: Linie zu Linie ohne etwas dazwischen, oder Raum zu Raum.</li><li><b>Quinte</b>: Linie zu Linie mit einer Linie dazwischen.</li><li><b>Septime</b>: zwei Linien dazwischen.</li><li>Gerade Intervalle (Quarte, Sexte, Oktave) wechseln von Linie auf Raum.</li></ul>
       <h3>Groß und klein</h3>
       <p>Terzen gibt es in zwei Größen: die <b>große Terz</b> (C zu E, vier Halbtöne) klingt nach Dur, die <b>kleine</b> (E zu G, drei Halbtöne) nach Moll. Im Notentrainer zählt nur der Buchstabenabstand. Das reicht zum Lesen, die Größe ergibt sich aus der Tonart.</p>`,
      `<h3>Wozu?</h3>
       <p>Geübte Leser lesen nicht Note für Note, sondern <b>Bewegungen</b>: Schritt, Sprung, wie weit, wohin. Wer eine Terz auf einen Blick sieht, muss die zweite Note nicht mehr benennen. Genau das übt der Modus.</p>
       <h3>Der Modus Intervalle</h3>
       <p>Über jeder Note steht die Bewegung zur vorigen, etwa „↑ Terz“. Die erste Note ist ein <b>Anker</b> mit Namen (meist C4, G4, F3 oder C5). Nur weiße Tasten. Einstellung „Intervalle bis“: Terz, Quinte oder Oktave.</p>
       ${tip("Das Quiz „Intervalle“ fragt den Abstand zweier Noten ab, ohne Klavier. Gut für unterwegs.")}`,
    ] },

    { id: "modi", tab: "Üben", icon: "▶", colors: ["#ffa25e", "#e8621c"], title: "Einzeln, Lauf, Blindflug", pages: [
      `<div class="ribbon display">Einzeln und Lauf</div>
       <p><b>Einzeln</b>: Eine Note steht im System, du hast Zeit. Jede Taste zählt als Antwort, richtig oder falsch; gemessen wird die <b>Reaktionszeit</b>. Die <b>Geisternote</b> zeigt bei Fehlern halbdurchsichtig rot, was du gespielt hast.</p>
       <p><b>Lauf</b>: Die Noten kommen von rechts und müssen an der roten Linie getroffen werden. Das Zeitfenster ist <b>±150 ms</b> (Millisekunden, Tausendstelsekunden): rechts der Linie ist zu früh, links zu spät. Wer gar nicht spielt, sieht die Note rot werden.</p>
       ${fig("flying", 170, "So läuft ein Lauf: die Note wird grün, wenn sie an der Linie getroffen wird.")}
       <p>Häufig verfehlte Noten kommen öfter dran, über den ganzen Verlauf. Die Anzahl je Lauf, Tempo, Schlüssel, Umfang und Tasten stehen in den Einstellungen.</p>`,
      `<h3>Blindflug</h3>
       <p>Die Note verschwindet ein oder zwei Schläge vor der Linie und du spielst aus dem Kopf. Das zwingt zum <b>Vorauslesen</b>: gute Blattspieler lesen einen Takt voraus. Einstellung „Vorausschau“ und Welt „Blindflug“.</p>
       <h3>Nachsitzen</h3>
       <p>Im Ergebnis steht <b>Fehler üben</b>: die verfehlten Noten kommen sofort nochmal, dreimal je Note. Bei Stücken kommen die verfehlten Takte als Ausschnitte.</p>
       <h3>Tempo-Leiter</h3>
       <p>Eingeschaltet, geht das Tempo nach einer Runde ab 90 % Quote fünf Schläge hoch, unter 70 % fünf runter. So steigert sich das Tempo von selbst.</p>`,
      `<h3>Wackeln und Klang</h3>
       <p>Das Bild wackelt bei Fehlern, abschaltbar. Spielgeräusche ebenso. Der <b>Synth</b> ist der eingebaute Klangerzeuger: Er spielt, wenn kein Piano angeschlossen ist, etwa beim Abspielen oder im Gehör-Modus. Ist das Piano dran, klingt es selbst.</p>
       ${tip("Erst langsam und fehlerfrei, dann schneller. Eine Quote über 90 % bei niedrigem Tempo bringt mehr als 70 % bei hohem.")}`,
    ] },

    { id: "stuecke", tab: "Stücke", icon: "♫", colors: ["#ffe066", "#f0b400"], title: "Stücke und beide Hände", pages: [
      `<div class="ribbon display">Stücke</div>
       <p>In der <b>Bibliothek</b> liegen vier Starter-Stücke, eigene lassen sich importieren. Der Modus <b>Stücke</b> zieht <b>Phrasen</b> daraus: kurze Ausschnitte von ein bis zwei Takten, an Taktgrenzen geschnitten, gewichtet nach dem, was zuletzt schwerfiel. Der Titel steht unter dem System, der Taktstrich davor.</p>
       <p><b>Ganz spielen</b> wertet ein Stück von vorn bis hinten. <b>Abspielen</b> lässt das Piano (oder den Synth) das Stück vorspielen, ohne Wertung.</p>
       <h3>Das Klaviersystem</h3>
       ${fig("grand", 175, "Klaviersystem: oben die rechte Hand im Violinschlüssel, unten die linke im Bassschlüssel, hier mit einem Akkord.")}
       <p>Zwei Systeme mit einer <b>Klammer</b> gehören zusammen und werden gleichzeitig gelesen: oben die rechte Hand, unten die linke. Bei „beide Hände“ zählt jede Note in beiden Systemen.</p>`,
      `<h3>Akkorde</h3>
       <p>Ein <b>Akkord</b> sind mehrere Töne auf einmal: im System mehrere Köpfe an einem Hals, die <b>gleichzeitig</b> angeschlagen werden. Jeder Ton wird einzeln gewertet: zwei von drei getroffen heißt ein Fehler. Der <b>Dreiklang</b>, drei Töne im Terzabstand übereinander wie C E G, ist der Grundbaustein der Begleitung.</p>
       <h3>Fingersatz aus der Datei</h3>
       <p>Steht in der Notendatei ein Fingersatz, erscheint die Ziffer violett über der Note: 1 Daumen bis 5 kleiner Finger. MIDI kann Finger nicht messen, die Ziffer ist eine Vorgabe.</p>
       ${tip("Akkorde in der linken Hand kommen im Abenteuer erst in der Welt „Linke Hand“, nach den halben Noten von „Hänschen klein“.")}`,
      `<h3>Eigene Stücke</h3>
       <p>Noten kommen als <b>MusicXML</b> herein, dem Austauschformat für Notendateien. In MuseScore (einem kostenlosen Notenprogramm) oder einem anderen Programm als <b>unkomprimiertes MusicXML</b> (.musicxml) exportieren und in der Bibliothek importieren. Gezippte .mxl-Dateien vorher entpacken. Die Hand ist wählbar; Ausschnitte außerhalb deines Tonumfangs werden weggelassen, nichts wird in eine andere Tonart verschoben.</p>
       <p>Ein <b>Haltebogen</b> verbindet zwei gleiche Noten zu einer langen: die zweite wird nicht neu angeschlagen, das weiß der Trainer. Ein <b>Bindebogen</b> über verschiedene Noten heißt „gebunden spielen“; er wird noch nicht gezeichnet.</p>
       ${tip("Hände erst getrennt, dann zusammen: so sind auch die Welten „Stücke“, „Linke Hand“ und „Beide Hände“ gebaut.")}`,
    ] },

    { id: "gehoer", tab: "Gehör", icon: "?", colors: ["#b79bff", "#7c3aed"], title: "Gehör und Quiz", pages: [
      `<div class="ribbon display">Gehör</div>
       <p>Das Piano (oder der Synth, der eingebaute Klangerzeuger) spielt einen Ton, im System steht nur ein <b>Fragezeichen</b>. Finde die Taste. Liegst du daneben, sagt die Anzeige <b>höher</b> oder <b>tiefer</b> und der Ton kommt nochmal. <b>Nochmal hören</b> spielt ihn jederzeit erneut.</p>
       <p>Der Tonumfang kommt aus den Einstellungen. Tipp: Erst grob einordnen, ob der Ton hoch, mittel oder tief liegt, dann suchen. Ein Vergleichston hilft: spiel C4 und höre, ob der gesuchte Ton darüber oder darunter liegt.</p>
       ${tip("Reaktionszeit zählt auch hier: schnelles Erkennen ist das Ziel, nicht nur richtiges.")}`,
      `<h3>Quiz</h3>
       <p>Ganz ohne Klavier, also auch am Handy unterwegs:</p>
       <ul><li><b>Notennamen</b>: eine Note im System, den Buchstaben antippen. Mit Piano zählt auch die Taste, dann mit Oktave.</li>
       <li><b>Tonarten</b>: Vorzeichnung sehen, Tonart antippen. Die parallele Moll-Tonart steht klein dabei.</li>
       <li><b>Intervalle</b>: zwei Noten, den Abstand benennen.</li></ul>
       <p>Fragen je Runde in den Einstellungen. Notennamen-Antworten zählen in die Statistik wie gespielte Noten.</p>`,
    ] },

    { id: "abenteuer", tab: "Abenteuer", icon: "⚑", colors: ["#ff7cc0", "#e0338a"], title: "Das Abenteuer", pages: [
      `<div class="ribbon display">Das Abenteuer</div>
       <p>Eine Karte mit <b>14 Welten</b>. Level 1 liegt unten, der Pfad führt nach oben. Tipp auf einen Knoten öffnet die Level-Karte: was drankommt, die Sternschwellen, ein Tipp, dein bestes Ergebnis.</p>
       <ul><li><b>Sterne</b>: 1 ab 60 % Quote, 2 ab 80 %, 3 ab 95 %. <b>Bosse</b>, das letzte und etwas schwerere Level jeder Welt, verlangen 70, 85 und 97 %.</li>
       <li><b>Weiter</b> geht es ab zwei Sternen. Drei sind kein Muss, aber ein Ziel für später.</li>
       <li><b>Bonus</b>: 25 XP je Stern, Bosse 50 extra.</li>
       <li><b>Abbrechen</b> zählt nicht: kein Stern, zurück zur Karte.</li>
       <li>Jedes Level bringt Schlüssel, Umfang, Tasten und Tempo selbst mit. Die Einstellungen gelten nur beim freien Üben, außer Notennamen und Geisternote.</li></ul>
       ${tip("Jede neue Sache fängt klein an: wenige Töne, langsam, kurz. Danach ändert sich pro Level nur eines, Tempo oder Umfang, in kleinen Schritten.")}`,
      `<h3>Die Welten</h3>
       <ol class="worlds"><li><b>Erste Schritte</b>: zwei bis fünf Töne, erst stehend, dann im Lauf.</li><li><b>Die rechte Hand</b>: bis zum C5.</li><li><b>Intervalle</b>: Bewegung lesen.</li><li><b>Der Bassschlüssel</b>: die linke Hand liest.</li><li><b>Über die Linien</b>: Hilfslinien oben und unten.</li><li><b>Rhythmus</b>: Notenwerte, Pausen, ohne Metronom.</li><li><b>Schwarze Tasten</b>: Kreuze und Bs.</li><li><b>Tonleitern</b>: mit Vorzeichnung, bis zwei Oktaven.</li><li><b>Stücke</b>: Ausschnitte und ganze Stücke rechts.</li><li><b>Linke Hand</b>: dasselbe links, mit Akkorden.</li><li><b>Beide Hände</b>: das Klaviersystem.</li><li><b>Tempo</b>: Bekanntes, nur schneller.</li><li><b>Blindflug</b>: die Note verschwindet vor der Linie.</li><li><b>Meister</b>: alles zusammen.</li></ol>
       <p>Klappt ein Level nicht: <b>Nochmal</b>, oder dasselbe frei üben, mit demselben Umfang und langsamer. Die Level-Karte nennt beides.</p>`,
    ] },

    { id: "technik", tab: "Technik", icon: "⚙", colors: ["#86b8ff", "#2563eb"], title: "Piano und MIDI", pages: [
      `<div class="ribbon display">Verbindung</div>
       <p><b>MIDI</b> überträgt keine Töne, sondern Tastendaten: welche Taste, wie fest, wann gedrückt und losgelassen. Genau das braucht der Trainer.</p>
       <ul><li>Das <b>Interface</b> (der kleine Adapter mioXC zwischen Piano und iPad) hat zwei Stecker: <b>IN</b> an die Buchse <b>MIDI OUT</b> des Pianos (lesen), <b>OUT</b> an <b>MIDI IN</b> (abspielen). Die Beschriftung ist aus Sicht des Interfaces.</li>
       <li>Die USB-Buchse des Pianos braucht einen <b>Treiber</b> (Zusatzsoftware vom Hersteller), und den können iPad und Handy nicht installieren. Darum der Umweg über das Interface.</li>
       <li>Am <b>iPad</b> läuft die Seite in der App „MIDIWeb Browser“, weil Safari kein <b>Web MIDI</b> kennt (die Schnittstelle, mit der eine Webseite das Piano hört). Am Android-Handy in Chrome.</li></ul>
       <h3>Die Statuszeile</h3>
       <ul><li><b>MIDI wird gesucht</b>: die Anfrage läuft.</li><li><b>Verbunden: mioXC</b>: alles bereit.</li><li><b>Bereit, aber kein Instrument</b>: nur ein Anschluss, der in der Software existiert; Interface anstecken.</li><li><b>MIDI fehlgeschlagen</b>: auf „MIDI verbinden“ tippen, manche Browser fragen nur nach einem Tipp.</li></ul>`,
      `<h3>Pedale</h3>
       <p>Das <b>Haltepedal</b> (rechts) lässt Töne nach dem Loslassen weiterklingen; an der CLP-330 ist es stufenlos. <b>Sostenuto</b> (Mitte) hält nur die Töne, die beim Treten schon liegen. <b>Una corda</b> (links) macht leiser und weicher. Alle drei werden angezeigt und mitgeschrieben, gewertet werden sie noch nicht.</p>
       <h3>Namen am Bedienfeld</h3>
       <p>Yamaha nennt das mittlere C auf dem Bedienfeld „C3“, der Notentrainer „C4“. Das ist nur ein anderer Name für dieselbe Taste, die Note im System ist maßgeblich.</p>
       <h3>Abspielen</h3>
       <p>Ist das Piano über den OUT-Stecker angeschlossen, klingt das Stück aus dem echten Instrument. Sonst spielt der eingebaute Synth. Einstellung „Abspielen über“.</p>`,
      `<h3>Deine Daten</h3>
       <p>Alles bleibt in diesem Browser: jede gezeigte Note, jeder Anschlag, jede Sitzung, der Abenteuer-Stand. Nichts geht ins Netz. <b>Exportieren</b> in der Statistik schreibt eine Datei, <b>Importieren</b> führt sie auf einem anderen Gerät zusammen.</p>
       ${tip("Die Seite selbst kommt von GitHub Pages, dem Dienst, der sie ausliefert, und braucht nur beim Laden Netz. Danach läuft alles lokal.")}`,
    ] },

    { id: "glossar", tab: "Begriffe", icon: "Aa", colors: ["#5ee8b3", "#0f766e"], title: "Begriffe", pages: [
      `<div class="ribbon display">Begriffe A bis E</div>
       ${dl([["Akkord", "mehrere Töne gleichzeitig, im System übereinander an einem Hals."], ["Anschlagstärke", "wie fest die Taste gedrückt wurde (MIDI: Velocity, 1 bis 127). Bestimmt die Lautstärke."], ["Auflösungszeichen ♮", "hebt ein Kreuz oder B auf."], ["Blindflug", "Modus-Zusatz: die Note verschwindet vor der Linie, du spielst aus dem Kopf."], ["Bosse", "das letzte, etwas schwerere Level jeder Welt im Abenteuer."], ["bpm", "Schläge pro Minute, das Tempo."], ["Daumenuntersatz", "der Daumen geht unter der Hand durch, damit die Tonleiter weitergeht."], ["Dreiklang", "Akkord aus Grundton, Terz und Quinte, etwa C E G."], ["Dur, Moll", "die zwei Klangfarben der Tonarten: Dur hell, Moll dunkel; unterschieden durch die große oder kleine Terz."], ["Einzähler", "ein Takt Klicks vor der ersten Note."], ["Enharmonisch", "zwei Namen für dieselbe Taste, Fis und Ges."]])}`,
      `<div class="ribbon display">Begriffe F bis K</div>
       ${dl([["Fingersatz", "Ziffern 1 bis 5 für Daumen bis kleiner Finger."], ["Ganzton, Halbton", "Halbton: die nächste Taste. Ganzton: zwei Tasten weiter."], ["Geisternote", "zeigt bei Fehlern halbdurchsichtig rot, welche Note du gespielt hast."], ["Grundton", "der erste Ton der Tonart, nach dem sie heißt."], ["Hilfslinie", "kurze Linie für Töne über oder unter dem System."], ["Interface", "der Adapter zwischen Piano und iPad (hier das mioXC)."], ["Intervall", "Abstand zweier Töne, nach Buchstaben gezählt."], ["Klaviatur", "die Tastenreihe des Pianos."], ["Klaviersystem", "zwei Systeme mit Klammer, rechte und linke Hand."]])}`,
      `<div class="ribbon display">Begriffe L bis P</div>
       ${dl([["Legato, Staccato", "gebunden (die Töne gehen ineinander über) oder kurz abgesetzt."], ["Leitton", "der siebte Ton einer Tonart, einen Halbton unter dem Grundton, er drängt dorthin."], ["Metronom", "klickt auf jedem Schlag, betont auf der Eins."], ["MIDI", "Datenformat für Tastendaten zwischen Instrument und Rechner."], ["Modus", "eine Übungsart, etwa Lauf oder Quiz."], ["MusicXML", "Dateiformat für Noten, aus Programmen wie MuseScore."], ["Nachsitzen", "der Knopf „Fehler üben“ im Ergebnis: verfehlte Noten sofort nochmal."], ["Oktave", "Abstand von einem C zum nächsten, acht Buchstaben."], ["Phrase", "ein kurzer Ausschnitt aus einem Stück, hier ein bis zwei Takte."], ["Punktierung", "der Punkt hinter der Note verlängert sie um die Hälfte."]])}`,
      `<div class="ribbon display">Begriffe Q bis S</div>
       ${dl([["Quintenzirkel", "Ordnung der Tonarten nach Quinten und Anzahl der Vorzeichen."], ["Quote", "Anteil der richtigen Antworten, in Prozent."], ["Schlüssel", "legt fest, welcher Ton auf welcher Linie liegt: Violin- (G4) und Bassschlüssel (F3)."], ["Serie, Multi", "Treffer in Folge; ab 10, 20, 30 verdoppelt, verdreifacht, vervierfacht sich die XP."], ["Synth", "der eingebaute Klangerzeuger, wenn kein Piano klingt."]])}`,
      `<div class="ribbon display">Begriffe T bis Z</div>
       ${dl([["Takt, Taktart", "Abschnitt zwischen Taktstrichen; die Taktart nennt die Schläge je Takt."], ["Tempo-Leiter", "Einstellung: das Tempo steigt nach guten Runden von selbst."], ["Tonart", "Tonvorrat und Grundton eines Stücks, erkennbar an der Vorzeichnung."], ["Treiber", "Zusatzsoftware für ein Gerät; iPad und Handy können keine installieren."], ["Vorzeichen, Vorzeichnung", "Kreuz oder B vor einer Note bzw. hinter dem Schlüssel für das ganze Stück."], ["Web MIDI", "die Schnittstelle, mit der eine Webseite das Piano hört. Chrome kann sie, Safari nicht."], ["XP, Level", "Erfahrungspunkte aus Treffern; das Level steigt mit ihnen."]])}`,
    ] },
  ];
  const byId = new Map(CHAPTERS.map(c => [c.id, c]));
  const MODE_CHAPTER = { single: "modi", run: "modi", interval: "intervalle", rhythm: "rhythmus", scale: "tonleitern", phrase: "stuecke", piece: "stuecke", play: "stuecke", ear: "gehoer", quiz: "gehoer" };

  /* --- Figuren: der Notenzeichner malt auf kleine Canvases ---------------- */
  function base(canvas, spec) {
    N.attach(canvas);
    const L = N.layout(Object.assign({ keyFifths: 0, time: null, labels: true, maxGap: 30 }, spec));
    if (!L) return null;
    N.drawStaves(L);
    return L;
  }
  const noteOf = (midi, dur, preferFlat) => { const s = MU.spell(midi, preferFlat); return { midi, diatonic: s.diatonic, dur: dur || 4, accidental: s.alter === 1 ? "sharp" : s.alter === -1 ? "flat" : null }; };
  const stepsOf = (clef, midis) => { const bd = N.bottomDiatonic(clef); let above = 0, below = 0; for (const m of midis) { const st = MU.spell(m).diatonic - bd; above = Math.max(above, st - 8); below = Math.max(below, -st); } return { above, below }; };
  const slots = (L, n) => { const w = (L.right - L.contentLeft - L.GAP) / n; return i => L.contentLeft + L.GAP * 0.5 + w * i + w / 2 - N.M.wholeW * L.GAP / 2; };

  function row(canvas, clef, midis, o) {
    o = o || {};
    const L = base(canvas, { staves: [Object.assign({ clef }, stepsOf(clef, midis))], keyFifths: o.fifths || 0, fingers: !!o.fingers });
    if (!L) return;
    const x = slots(L, midis.length);
    midis.forEach((m, i) => N.drawNote(L, 0, noteOf(m, o.dur || 4, (o.fifths || 0) < 0), x(i), { label: o.labels === false ? null : (o.labelFn ? o.labelFn(m, i) : nm(m)), finger: o.fingers ? o.fingers[i] : null }));
  }
  function keyboard(canvas, blackNames) {
    const c = canvas.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const n = 8, kw = Math.min(56, (W - 20) / n), x0 = (W - kw * n) / 2, kh = H - 14, top = 6;
    const white = ["C", "D", "E", "F", "G", "A", naming() === "de" ? "H" : "B", "C"], oct = [4, 4, 4, 4, 4, 4, 4, 5];
    c.font = `700 ${Math.round(kw * 0.3)}px "Baloo 2", "Segoe UI", system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "alphabetic";
    for (let i = 0; i < n; i++) {
      c.fillStyle = "#fffdf7"; c.strokeStyle = "#3b2f24"; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect ? c.roundRect(x0 + i * kw, top, kw, kh, [0, 0, 5, 5]) : c.rect(x0 + i * kw, top, kw, kh); c.fill(); c.stroke();
      c.fillStyle = "#3b2f24"; c.fillText(white[i] + oct[i], x0 + i * kw + kw / 2, top + kh - 8);
    }
    const blacks = [[0, "Cis", "Des"], [1, "Dis", "Es"], [3, "Fis", "Ges"], [4, "Gis", "As"], [5, "Ais", "B"]];
    c.font = `700 ${Math.round(kw * 0.22)}px "Baloo 2", "Segoe UI", system-ui, sans-serif`;
    for (const [i, up, down] of blacks) {
      const bx = x0 + (i + 1) * kw - kw * 0.3, bw = kw * 0.6, bh = kh * 0.62;
      c.fillStyle = "#1f1a16"; c.beginPath(); c.roundRect ? c.roundRect(bx, top, bw, bh, [0, 0, 4, 4]) : c.rect(bx, top, bw, bh); c.fill();
      if (blackNames) { c.fillStyle = "#ffd23f"; c.fillText(up, bx + bw / 2, top + bh * 0.42); c.fillStyle = "#9ad8ff"; c.fillText(down, bx + bw / 2, top + bh * 0.42 + kw * 0.26); }
    }
  }
  const FIGS = {
    treble: c => row(c, "treble", [60, 62, 64, 65, 67, 69, 71, 72]),
    bass: c => row(c, "bass", [48, 50, 52, 53, 55, 57, 59, 60]),
    ledger: c => row(c, "treble", [55, 57, 60, 79, 81, 84]),
    keyboard: c => keyboard(c, false),
    keyboardBlack: c => keyboard(c, true),
    values: c => {
      const durs = [4, 2, 1, 0.5, 0.25, 1.5], names = ["Ganze", "Halbe", "Viertel", "Achtel", "Sechzehntel", "punktiert"];
      const L = base(c, { staves: [{ clef: "treble", above: 2, below: 4.5 }], labels: false }); if (!L) return;
      const x = slots(L, durs.length);
      durs.forEach((d, i) => { N.drawNote(L, 0, noteOf(71, d), x(i), { stemUp: false }); N.drawText(L, names[i], x(i) + N.M.headW * L.GAP / 2, L.staves[0].bottomY + L.GAP * (i % 2 ? 2.9 : 2.0), 0.66, "#3b2f24"); });
    },
    rests: c => {
      const durs = [4, 2, 1, 0.5], names = ["Ganze", "Halbe", "Viertel", "Achtel"];
      const L = base(c, { staves: [{ clef: "treble", above: 0, below: 3 }], labels: false }); if (!L) return;
      const x = slots(L, durs.length);
      durs.forEach((d, i) => { N.drawRest(L, 0, d, x(i), N.COL.ink); N.drawText(L, names[i], x(i) + L.GAP * 0.6, L.staves[0].bottomY + L.GAP * 2.1, 0.72, "#3b2f24"); });
    },
    time: c => {
      const L = base(c, { staves: [{ clef: "treble", above: 0, below: 2 }], time: { beats: 4, beatType: 4 }, labels: false }); if (!L) return;
      const items = [[71, 1], [71, 1], [71, 1], [71, 1], "bar", [71, 2], [71, 2], "bar", [71, 4], "bar"];
      const x = slots(L, items.length);
      items.forEach((it, i) => { if (it === "bar") N.drawBarline(L, x(i) + L.GAP * 0.4, N.COL.ink); else N.drawNote(L, 0, noteOf(it[0], it[1]), x(i), { stemUp: false }); });
      ["1", "2", "3", "4"].forEach((t, i) => N.drawText(L, t, x(i) + N.M.headW * L.GAP / 2, L.staves[0].bottomY + L.GAP * 1.6, 0.7, "#3b2f24"));
    },
    accidentals: c => {
      const L = base(c, { staves: [{ clef: "treble", above: 0, below: 2 }] }); if (!L) return;
      const items = [[{ diatonic: MU.spell(65).diatonic, dur: 4, accidental: "sharp" }, "Fis"], [{ diatonic: MU.spell(71).diatonic, dur: 4, accidental: "flat" }, "B"], [{ diatonic: MU.spell(71).diatonic, dur: 4, accidental: "natural" }, "H"]];
      const x = slots(L, items.length);
      items.forEach(([n, l], i) => N.drawNote(L, 0, n, x(i), { label: l }));
    },
    // Nur der Buchstabe, sonst laufen "Fis5" und "G5" auf schmalen Seiten ineinander.
    keyG: c => row(c, "treble", [67, 69, 71, 72, 74, 76, 78, 79], { fifths: 1, labelFn: m => MU.shortName(m, naming(), false) }),
    keyF: c => row(c, "treble", [65, 67, 69, 70, 72, 74, 76, 77], { fifths: -1, labelFn: m => MU.shortName(m, naming(), true) }),
    scale: c => row(c, "treble", [60, 62, 64, 65, 67, 69, 71, 72], { dur: 1, fingers: [1, 2, 3, 1, 2, 3, 4, 5] }),
    intervals: c => {
      const pairs = [[62, "Sekunde"], [64, "Terz"], [65, "Quarte"], [67, "Quinte"], [69, "Sexte"], [71, "Septime"], [72, "Oktave"]];
      const L = base(c, { staves: [Object.assign({ clef: "treble" }, stepsOf("treble", [60, 72]), { above: 6 })] }); if (!L) return;
      const x = slots(L, pairs.length);
      // Beide Toene uebereinander (harmonisches Intervall), so passt jedes Paar in einen Schlitz.
      pairs.forEach(([m, l], i) => { const xx = x(i); N.drawChord(L, 0, [noteOf(60, 4), noteOf(m, 4)], xx, {}); N.drawText(L, l, xx + N.M.wholeW * L.GAP / 2, L.staves[0].topY - L.GAP * (i % 2 ? 2.4 : 1.3), 0.62, "#3b2f24"); });
    },
    grand: c => {
      const L = base(c, { staves: [{ clef: "treble", above: 0, below: 0 }, { clef: "bass", above: 0, below: 0 }], labels: false }); if (!L) return;
      const x = slots(L, 4);
      [[67, 1], [69, 1], [71, 1], [72, 1]].forEach(([m, d], i) => N.drawNote(L, 0, noteOf(m, d), x(i), {}));
      N.drawChord(L, 1, [noteOf(48, 4), noteOf(52, 4), noteOf(55, 4)], x(0), {});
      N.drawChord(L, 1, [noteOf(43, 4), noteOf(47, 4), noteOf(50, 4)], x(2), {});
    },
    flying: c => drawFlying(c, performance.now()),
  };

  // Der Lauf als Bild: Noten laufen zur Linie und werden dort grün. Läuft in einer Schleife von acht Sekunden.
  function drawFlying(c, now) {
    const L = base(c, { staves: [{ clef: "treble", above: 0, below: 0 }], labels: false }); if (!L) return;
    const period = 8000, lead = 3000, t = now % period;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tt = reduce ? 4200 : t;
    N.clipContent(L);
    [[60, 1500], [64, 2500], [67, 3500], [65, 4500], [62, 5500], [60, 6500]].forEach(([m, due]) => {
      const x = L.nowX + ((due - tt) / lead) * (L.right - L.nowX);
      if (x > L.right + L.GAP * 2 || x < L.contentLeft - L.GAP * 2) return;
      N.drawNote(L, 0, noteOf(m, 1), x, { colour: tt >= due ? N.COL.ok : N.COL.ink });
    });
    N.unclip();
    N.drawNowLine(L);
  }

  /* --- Bildschirm --------------------------------------------------------- */
  function render() {
    const ch = byId.get(B.chapter) || CHAPTERS[0];
    const tabs = $("bookTabs");
    tabs.innerHTML = CHAPTERS.map(k => `<button class="tab ${k.id === ch.id ? "active" : ""}" data-chapter="${k.id}" style="--ta:${k.colors[0]};--tb:${k.colors[1]}" title="${k.title}"><span class="ico">${k.icon}</span><span class="tl display">${k.tab}</span></button>`).join("");
    const pages = ch.pages, total = Math.ceil(pages.length / 2), spread = Math.min(B.page, total - 1);
    B.page = spread;
    const left = pages[spread * 2] || "", right = pages[spread * 2 + 1] || "";
    $("bookLeft").innerHTML = `<div class="pageBody">${left}</div>`;
    $("bookRight").innerHTML = `<div class="pageBody">${right || `<div class="endMark">♪</div>`}</div>`;
    $("bookLeft").scrollTop = 0; $("bookRight").scrollTop = 0;
    $("bookPageNo").textContent = `${ch.title} · Seite ${spread + 1} / ${total}`;
    $("bookPrev").disabled = spread === 0 && CHAPTERS.indexOf(ch) === 0;
    $("bookNext").disabled = spread >= total - 1 && CHAPTERS.indexOf(ch) === CHAPTERS.length - 1;
    document.querySelectorAll("#screen-book .page").forEach(p => p.style.setProperty("--tc", ch.colors[1]));
    sizeIcons();
    requestAnimationFrame(drawFigures);
  }
  // Die Symbole der Lesezeichen kommen aus verschiedenen Schriften und sind
  // unterschiedlich hoch und verschoben. Hier wird jede Glyphe nachgemessen
  // (Tintenkasten) und so skaliert und versetzt, dass alle gleich hoch und
  // mittig sitzen, egal welche Schrift das Geraet liefert.
  function sizeIcons() {
    const c = document.createElement("canvas").getContext("2d");
    for (const el of document.querySelectorAll("#bookTabs .ico")) {
      const txt = el.textContent, fam = getComputedStyle(el).fontFamily;
      c.font = "100px " + fam;
      const m = c.measureText(txt);
      if (!m.actualBoundingBoxAscent && !m.actualBoundingBoxDescent) continue;
      const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const inkW = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
      const size = Math.min(100 * 28 / Math.max(inkH, 1), 100 * 44 / Math.max(inkW, 1));
      const k = size / 100;
      const emCY = ((m.fontBoundingBoxAscent || 80) - (m.fontBoundingBoxDescent || 20)) / 2;
      const inkCY = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      const dy = (emCY - inkCY) * k;                     // Tinte unter der Mitte: nach oben schieben
      const dx = (m.width / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2) * k;
      el.style.fontSize = size.toFixed(1) + "px";
      el.style.transform = `translate(${dx.toFixed(1)}px, ${(-dy).toFixed(1)}px)`;
    }
  }
  function drawFigures() {
    stopAnim();
    for (const c of document.querySelectorAll("#screen-book canvas[data-fig]")) {
      const f = FIGS[c.dataset.fig]; if (!f) continue;
      try { f(c); } catch (e) { console.error("Figur", c.dataset.fig, e); }
      if (c.dataset.fig === "flying") startAnim(c);
    }
  }
  function startAnim(c) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    B.anim = c;
    const step = now => { if (!B.anim || !document.body.contains(B.anim)) { B.anim = null; return; } drawFlying(B.anim, now); B.rafId = requestAnimationFrame(step); };
    B.rafId = requestAnimationFrame(step);
  }
  function stopAnim() { B.anim = null; cancelAnimationFrame(B.rafId); }

  function open(chapter, page) {
    if (chapter && byId.has(chapter)) B.chapter = chapter;
    B.page = page || 0;
    render();
  }
  const forMode = mode => MODE_CHAPTER[mode] || "start";
  function step(dir) {
    const ch = byId.get(B.chapter), total = Math.ceil(ch.pages.length / 2), idx = CHAPTERS.indexOf(ch);
    if (dir > 0) { if (B.page < total - 1) B.page++; else if (idx < CHAPTERS.length - 1) { B.chapter = CHAPTERS[idx + 1].id; B.page = 0; } }
    else { if (B.page > 0) B.page--; else if (idx > 0) { B.chapter = CHAPTERS[idx - 1].id; B.page = Math.ceil(CHAPTERS[idx - 1].pages.length / 2) - 1; } }
    render();
  }
  function bind(s) {
    settings = s;
    $("bookTabs").addEventListener("click", e => { const b = e.target.closest("button[data-chapter]"); if (b) open(b.dataset.chapter, 0); });
    $("bookPrev").addEventListener("click", () => step(-1));
    $("bookNext").addEventListener("click", () => step(1));
    B.ro = new ResizeObserver(() => { if (document.body.dataset.screen === "book") drawFigures(); });
    B.ro.observe($("bookLeft")); B.ro.observe($("bookRight"));
  }
  function leave() { stopAnim(); }

  return { CHAPTERS, open, render, forMode, step, bind, leave, drawFigures, sizeIcons, get chapter() { return B.chapter; } };
})();
