/* APSOparts Black Friday 2026 - the voucher's engine, from the hub's own picture storage (its name = its content's hash).
   Written by C:/dev/black-friday-2026/tools/gen_bf_page.py - never edited by hand. The page's voucher is the hub's module
   campaign-bf-voucher (or the pasted block, whose own copy of this script runs first - once per voucher). */
(function () {
  if (!/(^|\.)apsoparts\.com$/.test(location.hostname)) return;
(function () {
  try {
    var q = new URLSearchParams(location.search), from = "";
    try { from = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) {}
    if (/bot|crawl|spider|slurp|facebookexternalhit/i.test(navigator.userAgent || "")) return;
    if (!q.has("go") && !(location.pathname.split("/")[1] === "de-CH" && from !== location.hostname)) return;
    var ZONE = { "Europe/Zurich": "CH", "Europe/Vaduz": "CH", "Europe/Busingen": "CH", "Europe/Berlin": "DE", "Europe/Vienna": "AT",
                 "Europe/Paris": "FR", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Warsaw": "PL" };
    var SOLD = { CH: ["de", "fr", "it", "en"], DE: ["de", "en"], AT: ["de", "en"], FR: ["fr", "en"], IT: ["it", "en"],
                 NL: ["nl", "en"], PL: ["pl", "en"], INT: ["de", "en", "fr", "it", "nl"] };
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var c = ZONE[tz], i, k;
    if (!c && (!tz || /^(UTC|GMT|Etc\/)/.test(tz)))
      for (i = 0; i < langs.length && !c; i++) { k = (String(langs[i]).split("-")[1] || "").toUpperCase(); if (SOLD[k] && k !== "INT") c = k; }
    c = c || "INT";
    var l = "en";
    for (i = 0; i < langs.length; i++) { k = String(langs[i]).slice(0, 2).toLowerCase(); if (SOLD[c].indexOf(k) >= 0) { l = k; break; } }
    var sv = l + "-" + c, parts = location.pathname.split("/");
    q.delete("go");
    var rest = q.toString(), url = "/" + sv + "/" + parts.slice(2).join("/") + (rest ? "?" + rest : "") + location.hash;
    if (parts[1] === sv) history.replaceState(null, "", url); else location.replace(url);
  } catch (e) {}
})();
(function () {
  var root = document.getElementById("apbf");
  if (!root) return;
  // once per voucher: the block's own script and the engine on Railway (13.11.2026, the voucher MODULE) never both run it
  if (root.getAttribute("data-apbf-on")) return;
  root.setAttribute("data-apbf-on", "1");
  var TXT = (function (all) { return all[root.getAttribute('data-lang')] || all.en; })({"de": {"gateway": "https://ads-gateway-production.up.railway.app/api/promo/offer", "pct": "{n} %", "value_txt": "auf Ihre Bestellung", "code_title": "Ihr Black-Friday-Code", "copy": "Code kopieren", "copied": "Kopiert ✓", "how": "Im Warenkorb eingeben · gültig bis 6.12.2026 · einmal einlösbar", "unlocked": "Hier ist Ihr persönlicher Code – geben Sie ihn im Warenkorb ein.", "soon": "Ihr Code erscheint hier ab dem 16. November.", "wait": "Ihr Code wird freigeschaltet …", "ended": "Die Aktion ist beendet. Danke fürs Mitmachen!", "until": "Bis dahin", "best": "Unsere meistverkauften Produkte", "view": "Zum Produkt", "used_title": "Bereits eingelöst", "used_msg": "Der Code Ihrer Firma wurde am {date} eingelöst.", "used_lead": "Ihre Firma hat ihren persönlichen Black-Friday-Code bereits genutzt – ein Code pro Firma, einmal einlösbar.", "search": "{{store url='catalogsearch/result'}}", "top": [{"sku": "1120030016", "name": "NORMATEC® O-Ring NBR 70.00-01", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/56/296256.jpg", "paths": {"de-CH": "11411201-normatecr-o-ring-nbr-70-00-01.html"}}, {"sku": "1140012624", "name": "HITEC® O-Ring DW EPDM 70.503-00", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg", "paths": {"de-CH": "11400101-hitecr-o-ring-dw-epdm-70-503-00-nachfolge-von-hitecr-o-ring-epdm-70-10-02.html"}}, {"sku": "1140351814", "name": "HITEC® O-Ring FKM 75.16-04", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/52/296252.jpg", "paths": {"de-CH": "11400711-hitecr-o-ring-fkm-75-16-04.html"}}, {"sku": "0110150030", "name": "PTFE Rundstab natur (weiss)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/56/53/295653.jpg", "paths": {"de-CH": "01101515-ptfe-rundstab-natur-weiss.html"}}, {"sku": "0119350040", "name": "POM-C Rundstab natur (weiss)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/57/21/295721.jpg", "paths": {"de-CH": "02320201-pom-c-rundstab-natur-weiss.html"}}, {"sku": "0117154540", "name": "PEEK Rundstab natur (braun-grau)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/58/71/295871.jpg", "paths": {"de-CH": "01171545-peek-rundstab-natur-braun-grau.html"}}, {"sku": "1220360073", "name": "APSOvib® Anschlagpuffer Typ A, mittel", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/81/297281.jpg", "paths": {"de-CH": "12203603-apsovibr-anschlagpuffer-typ-a-mittel.html"}}, {"sku": "1220645000", "name": "APSOvib® Maschinenfüsse, verstärkt", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/73/34/297334.jpg", "paths": {"de-CH": "12206451-apsovibr-maschinenfusse-verstarkt.html"}}, {"sku": "1220330263", "name": "APSOvib® Rundpuffer Typ A, mittel", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/64/297264.jpg", "paths": {"de-CH": "12203303-apsovibr-rundpuffer-typ-a-mittel.html"}}, {"sku": "1220340273", "name": "APSOvib® Rundpuffer Typ B, mittel", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/70/297270.jpg", "paths": {"de-CH": "12203403-apsovibr-rundpuffer-typ-b-mittel.html"}}]}, "fr": {"gateway": "https://ads-gateway-production.up.railway.app/api/promo/offer", "pct": "{n} %", "value_txt": "sur votre commande", "code_title": "Votre code Black Friday", "copy": "Copier le code", "copied": "Copié ✓", "how": "À saisir dans le panier · valable jusqu’au 6.12.2026 · utilisable une fois", "unlocked": "Voici votre code personnel – saisissez-le dans le panier.", "soon": "Votre code s’affiche ici à partir du 16 novembre.", "wait": "Votre code se débloque …", "ended": "L’offre est terminée. Merci de votre participation !", "until": "D’ici là", "best": "Nos produits les plus vendus", "view": "Voir le produit", "used_title": "Déjà utilisé", "used_msg": "Le code de votre entreprise a été utilisé le {date}.", "used_lead": "Votre entreprise a déjà utilisé son code Black Friday personnel – un code par entreprise, utilisable une fois.", "search": "{{store url='catalogsearch/result'}}", "top": [{"sku": "1120030016", "name": "NORMATEC® O-Ring NBR 70.00-01", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/56/296256.jpg", "paths": {"fr-CH": "11411201-normatecr-o-ring-nbr-70-00-01.html", "fr-FR": "11411201-normatecr-o-ring-nbr-70-00-01.html", "fr-INT": "11411201-normatecr-o-ring-nbr-70-00-01.html"}}, {"sku": "1140012624", "name": "HITEC® O-Ring DW EPDM 70.503-00", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg", "paths": {"fr-CH": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successeur-du-hitecr-o-ring-epdm-70-10-02.html", "fr-FR": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successeur-du-hitecr-o-ring-epdm-70-10-02.html", "fr-INT": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successeur-du-hitecr-o-ring-epdm-70-10-02.html"}}, {"sku": "1140351814", "name": "HITEC® O-Ring FKM 75.16-04", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/52/296252.jpg", "paths": {"fr-CH": "11400711-hitecr-o-ring-fkm-75-16-04.html", "fr-FR": "11400711-hitecr-o-ring-fkm-75-16-04.html", "fr-INT": "11400711-hitecr-o-ring-fkm-75-16-04.html"}}, {"sku": "0110150030", "name": "Jet rond PTFE naturel (blanc)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/56/53/295653.jpg", "paths": {"fr-CH": "01101515-jet-rond-ptfe-naturel-blanc.html", "fr-FR": "01101515-jet-rond-ptfe-naturel-blanc.html", "fr-INT": "01101515-jet-rond-ptfe-naturel-blanc.html"}}, {"sku": "0119350040", "name": "Jet rond POM-C naturel (blanc)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/57/21/295721.jpg", "paths": {"fr-CH": "02320201-jet-rond-pom-c-naturel-blanc.html", "fr-FR": "02320201-jet-rond-pom-c-naturel-blanc.html", "fr-INT": "02320201-jet-rond-pom-c-naturel-blanc.html"}}, {"sku": "0117154540", "name": "Jet rond PEEK naturel (brun gris)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/58/71/295871.jpg", "paths": {"fr-CH": "01171545-jet-rond-peek-naturel-brun-gris.html", "fr-FR": "01171545-jet-rond-peek-naturel-brun-gris.html", "fr-INT": "01171545-jet-rond-peek-naturel-brun-gris.html"}}, {"sku": "1220360073", "name": "Butée APSOvib® A, moyen", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/81/297281.jpg", "paths": {"fr-CH": "12203603-butee-apsovibr-a-moyen.html", "fr-FR": "12203603-butee-apsovibr-a-moyen.html", "fr-INT": "12203603-butee-apsovibr-a-moyen.html"}}, {"sku": "1220645000", "name": "APSOvib® Pied machine renforcé", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/73/34/297334.jpg", "paths": {"fr-CH": "12206451-apsovibr-pied-machine-renforce.html", "fr-FR": "12206451-apsovibr-pied-machine-renforce.html", "fr-INT": "12206451-apsovibr-pied-machine-renforce.html"}}, {"sku": "1220330263", "name": "Plot cylindrique APSOvib® A, moyen", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/64/297264.jpg", "paths": {"fr-CH": "12203303-plot-cylindrique-apsovibr-a-moyen.html", "fr-FR": "12203303-plot-cylindrique-apsovibr-a-moyen.html", "fr-INT": "12203303-plot-cylindrique-apsovibr-a-moyen.html"}}, {"sku": "1220340273", "name": "Plot cylindrique APSOvib® B, moyen", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/70/297270.jpg", "paths": {"fr-CH": "12203403-plot-cylindrique-apsovibr-b-moyen.html", "fr-FR": "12203403-plot-cylindrique-apsovibr-b-moyen.html", "fr-INT": "12203403-plot-cylindrique-apsovibr-b-moyen.html"}}]}, "it": {"gateway": "https://ads-gateway-production.up.railway.app/api/promo/offer", "pct": "{n}%", "value_txt": "sul tuo ordine", "code_title": "Il tuo codice Black Friday", "copy": "Copia codice", "copied": "Copiato ✓", "how": "Da inserire nel carrello · valido fino al 6.12.2026 · utilizzabile una volta", "unlocked": "Ecco il tuo codice personale – inseriscilo nel carrello.", "soon": "Il tuo codice appare qui dal 16 novembre.", "wait": "Il tuo codice si sta sbloccando …", "ended": "L’offerta è terminata. Grazie per la partecipazione!", "until": "Nel frattempo", "best": "I nostri prodotti più venduti", "view": "Vedi il prodotto", "used_title": "Già utilizzato", "used_msg": "Il codice della tua azienda è stato utilizzato il {date}.", "used_lead": "La tua azienda ha già utilizzato il suo codice Black Friday personale – un codice per azienda, utilizzabile una volta.", "search": "{{store url='catalogsearch/result'}}", "top": [{"sku": "1120030016", "name": "NORMATEC® O-Ring NBR 70.00-01", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/56/296256.jpg", "paths": {"it-CH": "11411201-normatecr-o-ring-nbr-70-00-01.html", "it-IT": "11411201-normatecr-o-ring-nbr-70-00-01.html", "it-INT": "11411201-normatecr-o-ring-nbr-70-00-01.html"}}, {"sku": "1140012624", "name": "HITEC® O-Ring DW EPDM 70.503-00", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg", "paths": {"it-CH": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successore-di-hitecr-o-ring-epdm-70-10-02.html", "it-IT": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successore-di-hitecr-o-ring-epdm-70-10-02.html", "it-INT": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successore-di-hitecr-o-ring-epdm-70-10-02.html"}}, {"sku": "1140351814", "name": "HITEC® O-Ring FKM 75.16-04", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/52/296252.jpg", "paths": {"it-CH": "11400711-hitecr-o-ring-fkm-75-16-04.html", "it-IT": "11400711-hitecr-o-ring-fkm-75-16-04.html", "it-INT": "11400711-hitecr-o-ring-fkm-75-16-04.html"}}, {"sku": "0110150030", "name": "Tondi PTFE naturale (bianco)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/56/53/295653.jpg", "paths": {"it-CH": "01101515-tondi-ptfe-naturale-bianco.html", "it-IT": "01101515-tondi-ptfe-naturale-bianco.html", "it-INT": "01101515-tondi-ptfe-naturale-bianco.html"}}, {"sku": "0119350040", "name": "Tondi POM-C naturale (bianco)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/57/21/295721.jpg", "paths": {"it-CH": "02320201-tondi-pom-c-naturale-bianco.html", "it-IT": "02320201-tondi-pom-c-naturale-bianco.html", "it-INT": "02320201-tondi-pom-c-naturale-bianco.html"}}, {"sku": "0117154540", "name": "Tondi PEEK naturale (marrone-grigio)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/58/71/295871.jpg", "paths": {"it-CH": "01171545-tondi-peek-naturale-marrone-grigio.html", "it-IT": "01171545-tondi-peek-naturale-marrone-grigio.html", "it-INT": "01171545-tondi-peek-naturale-marrone-grigio.html"}}, {"sku": "1220360073", "name": "Puffer paracolpi APSOvib® A, medium", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/81/297281.jpg", "paths": {"it-CH": "12203603-puffer-paracolpi-apsovibr-a-medium.html", "it-IT": "12203603-puffer-paracolpi-apsovibr-a-medium.html", "it-INT": "12203603-puffer-paracolpi-apsovibr-a-medium.html"}}, {"sku": "1220645000", "name": "APSOvib® Zoccolo rinforzato", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/73/34/297334.jpg", "paths": {"it-CH": "12206451-apsovibr-zoccolo-rinforzato.html", "it-IT": "12206451-apsovibr-zoccolo-rinforzato.html", "it-INT": "12206451-apsovibr-zoccolo-rinforzato.html"}}, {"sku": "1220330263", "name": "Puffer cilindrico APSOvib® A, medium", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/64/297264.jpg", "paths": {"it-CH": "12203303-puffer-cilindrico-apsovibr-a-medium.html", "it-IT": "12203303-puffer-cilindrico-apsovibr-a-medium.html", "it-INT": "12203303-puffer-cilindrico-apsovibr-a-medium.html"}}, {"sku": "1220340273", "name": "Puffer cilindrico APSOvib® B, medium", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/70/297270.jpg", "paths": {"it-CH": "12203403-puffer-cilindrico-apsovibr-b-medium.html", "it-IT": "12203403-puffer-cilindrico-apsovibr-b-medium.html", "it-INT": "12203403-puffer-cilindrico-apsovibr-b-medium.html"}}]}, "en": {"gateway": "https://ads-gateway-production.up.railway.app/api/promo/offer", "pct": "{n}%", "value_txt": "off your order", "code_title": "Your Black Friday code", "copy": "Copy code", "copied": "Copied ✓", "how": "Enter it in your basket · valid until 6.12.2026 · one use", "unlocked": "Here is your personal code – enter it in your basket.", "soon": "Your code appears here from 16 November.", "wait": "Unlocking your code …", "ended": "The offer has ended. Thank you for joining in!", "until": "Until then", "best": "Our best-selling products", "view": "View product", "used_title": "Already used", "used_msg": "Your company’s code was used on {date}.", "used_lead": "Your company has already used its personal Black Friday code – one code per company, usable once.", "search": "{{store url='catalogsearch/result'}}", "top": [{"sku": "1120030016", "name": "NORMATEC® O-ring NBR 70.00-01", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/56/296256.jpg", "paths": {"en-CH": "11411201-normatecr-o-ring-nbr-70-00-01.html", "en-INT": "11411201-normatecr-o-ring-nbr-70-00-01.html"}}, {"sku": "1140012624", "name": "HITEC® O-ring DW EPDM 70.503-00", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg", "paths": {"en-CH": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successor-of-hitecr-o-ring-epdm-70-10-02.html", "en-INT": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successor-of-hitecr-o-ring-epdm-70-10-02.html"}}, {"sku": "1140351814", "name": "HITEC® O-ring FKM 75.16-04", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/52/296252.jpg", "paths": {"en-CH": "11400711-hitecr-o-ring-fkm-75-16-04.html", "en-INT": "11400711-hitecr-o-ring-fkm-75-16-04.html"}}, {"sku": "0110150030", "name": "PTFE round bar natural (white)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/56/53/295653.jpg", "paths": {"en-CH": "01101515-ptfe-round-bar-natural-white.html", "en-INT": "01101515-ptfe-round-bar-natural-white.html"}}, {"sku": "0119350040", "name": "POM-C round bar natural (white)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/57/21/295721.jpg", "paths": {"en-CH": "02320201-pom-c-round-bar-natural-white.html", "en-INT": "02320201-pom-c-round-bar-natural-white.html"}}, {"sku": "0117154540", "name": "PEEK round bar natural (brown-grey)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/58/71/295871.jpg", "paths": {"en-CH": "01171545-peek-round-bar-natural-brown-grey.html", "en-INT": "01171545-peek-round-bar-natural-brown-grey.html"}}, {"sku": "1220360073", "name": "APSOvib® Stop buffer A, medium", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/81/297281.jpg", "paths": {"en-CH": "12203603-apsovibr-stop-buffer-a-medium.html", "en-INT": "12203603-apsovibr-stop-buffer-a-medium.html"}}, {"sku": "1220645000", "name": "APSOvib® Reinforced machine mounts", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/73/34/297334.jpg", "paths": {"en-CH": "12206451-apsovibr-reinforced-machine-mounts.html", "en-INT": "12206451-apsovibr-reinforced-machine-mounts.html"}}, {"sku": "1220330263", "name": "APSOvib® Cylindrical buffer A, medium", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/64/297264.jpg", "paths": {"en-CH": "12203303-apsovibr-cylindrical-buffer-a-medium.html", "en-INT": "12203303-apsovibr-cylindrical-buffer-a-medium.html"}}, {"sku": "1220340273", "name": "APSOvib® Cylindrical buffer B, medium", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/70/297270.jpg", "paths": {"en-CH": "12203403-apsovibr-cylindrical-buffer-b-medium.html", "en-INT": "12203403-apsovibr-cylindrical-buffer-b-medium.html"}}]}, "nl": {"gateway": "https://ads-gateway-production.up.railway.app/api/promo/offer", "pct": "{n}%", "value_txt": "op uw bestelling", "code_title": "Uw Black Friday-code", "copy": "Code kopiëren", "copied": "Gekopieerd ✓", "how": "Invoeren in het winkelmandje · geldig t/m 6.12.2026 · eenmalig te gebruiken", "unlocked": "Hier is uw persoonlijke code – voer hem in het winkelmandje in.", "soon": "Uw code verschijnt hier vanaf 16 november.", "wait": "Uw code wordt vrijgegeven …", "ended": "De actie is afgelopen. Bedankt voor uw deelname!", "until": "Tot dan", "best": "Onze best verkochte producten", "view": "Bekijk product", "used_title": "Al gebruikt", "used_msg": "De code van uw bedrijf is op {date} gebruikt.", "used_lead": "Uw bedrijf heeft zijn persoonlijke Black Friday-code al gebruikt – één code per bedrijf, eenmaal te gebruiken.", "search": "{{store url='catalogsearch/result'}}", "top": [{"sku": "1120030016", "name": "NORMATEC® O-ring NBR 70.00-01", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/56/296256.jpg", "paths": {"nl-NL": "11411201-normatecr-o-ring-nbr-70-00-01.html", "nl-INT": "11411201-normatecr-o-ring-nbr-70-00-01.html"}}, {"sku": "1140012624", "name": "HITEC® O-ring DW EPDM 70.503-00", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg", "paths": {"nl-NL": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successeur-du-hitecr-o-ring-epdm-70-10-02.html", "nl-INT": "11400101-hitecr-o-ring-dw-epdm-70-503-00-successeur-du-hitecr-o-ring-epdm-70-10-02.html"}}, {"sku": "1140351814", "name": "HITEC® O-ring FKM 75.16-04", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/52/296252.jpg", "paths": {"nl-NL": "11400711-hitecr-o-ring-fkm-75-16-04.html", "nl-INT": "11400711-hitecr-o-ring-fkm-75-16-04.html"}}, {"sku": "0110150030", "name": "PTFE rondstaf natuur (wit)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/56/53/295653.jpg", "paths": {"nl-NL": "01101515-ptfe-rondstaf-natuur-wit.html", "nl-INT": "01101515-ptfe-rondstaf-natuur-wit.html"}}, {"sku": "0119350040", "name": "POM-C rondstaf natuur (wit)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/57/21/295721.jpg", "paths": {"nl-NL": "02320201-pom-c-rondstaf-natuur-wit.html", "nl-INT": "02320201-pom-c-rondstaf-natuur-wit.html"}}, {"sku": "0117154540", "name": "PEEK rondstaf natuur (bruin-grijs)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/58/71/295871.jpg", "paths": {"nl-NL": "01171545-peek-rondstaf-natuur-bruin-grijs.html", "nl-INT": "01171545-peek-rondstaf-natuur-bruin-grijs.html"}}, {"sku": "1220360073", "name": "APSOvib® Aanslagbuffer Type A, middel", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/81/297281.jpg", "paths": {"nl-NL": "12203603-apsovibr-aanslagbuffer-type-a-middel.html", "nl-INT": "12203603-apsovibr-aanslagbuffer-type-a-middel.html"}}, {"sku": "1220645000", "name": "APSOvib® Machinevoet versterkte", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/73/34/297334.jpg", "paths": {"nl-NL": "12206451-apsovibr-machinevoet-versterkte.html", "nl-INT": "12206451-apsovibr-machinevoet-versterkte.html"}}, {"sku": "1220330263", "name": "APSOvib® Ronde buffer Type A, middel", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/64/297264.jpg", "paths": {"nl-NL": "12203303-apsovibr-ronde-buffer-type-a-middel.html", "nl-INT": "12203303-apsovibr-ronde-buffer-type-a-middel.html"}}, {"sku": "1220340273", "name": "APSOvib® Ronde buffer Type B, middel", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/70/297270.jpg", "paths": {"nl-NL": "12203403-apsovibr-ronde-buffer-type-b-middel.html", "nl-INT": "12203403-apsovibr-ronde-buffer-type-b-middel.html"}}]}, "pl": {"gateway": "https://ads-gateway-production.up.railway.app/api/promo/offer", "pct": "{n}%", "value_txt": "rabatu na zamówienie", "code_title": "Twój kod Black Friday", "copy": "Kopiuj kod", "copied": "Skopiowano ✓", "how": "Wpisz w koszyku · ważny do 6.12.2026 · jednorazowy", "unlocked": "Oto Twój osobisty kod – wpisz go w koszyku.", "soon": "Twój kod pojawi się tutaj od 16 listopada.", "wait": "Odblokowujemy Twój kod …", "ended": "Promocja zakończona. Dziękujemy za udział!", "until": "Do tego czasu", "best": "Nasze najczęściej kupowane produkty", "view": "Zobacz produkt", "used_title": "Już wykorzystany", "used_msg": "Kod Twojej firmy został wykorzystany dnia {date}.", "used_lead": "Twoja firma wykorzystała już swój osobisty kod Black Friday – jeden kod na firmę, do jednorazowego użycia.", "search": "{{store url='catalogsearch/result'}}", "top": [{"sku": "1120030016", "name": "NORMATEC® Pierścień O-ring NBR 70.00-01", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/56/296256.jpg", "paths": {"pl-PL": "11411201-normatecr-pierscien-o-ring-nbr-70-00-01.html"}}, {"sku": "1140012624", "name": "HITEC® Pierścień O-ring DW EPDM 70.503-00", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg", "paths": {"pl-PL": "11400101-hitecr-pierscien-o-ring-dw-epdm-70-503-00-nastepca-hitecr-o-ring-epdm-70-10-02.html"}}, {"sku": "1140351814", "name": "HITEC® Pierścień O-ring FKM 75.16-04", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/62/52/296252.jpg", "paths": {"pl-PL": "11400711-hitecr-pierscien-o-ring-fkm-75-16-04.html"}}, {"sku": "0110150030", "name": "PTFE wał okrągły naturalny (biały)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/56/53/295653.jpg", "paths": {"pl-PL": "01101515-ptfe-wal-okragly-naturalny-bialy.html"}}, {"sku": "0119350040", "name": "POM-C wał okrągły naturalny (biały)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/57/21/295721.jpg", "paths": {"pl-PL": "02320201-pom-c-wal-okragly-naturalny-bialy.html"}}, {"sku": "0117154540", "name": "PEEK wał okrągły naturalny (brązowo-szary)", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/58/71/295871.jpg", "paths": {"pl-PL": "01171545-peek-wal-okragly-naturalny-brazowo-szary.html"}}, {"sku": "1220360073", "name": "APSOvib® Zderzak  A, średni", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/81/297281.jpg", "paths": {"pl-PL": "12203603-apsovibr-zderzak-a-sredni.html"}}, {"sku": "1220645000", "name": "APSOvib® Wzmocnione elementy mocujące maszyn", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/73/34/297334.jpg", "paths": {"pl-PL": "12206451-apsovibr-wzmocnione-elementy-mocujace-maszyn.html"}}, {"sku": "1220330263", "name": "APSOvib® Amortyzator cylindryczny A, średni", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/64/297264.jpg", "paths": {"pl-PL": "12203303-apsovibr-amortyzator-cylindryczny-a-sredni.html"}}, {"sku": "1220340273", "name": "APSOvib® Amortyzator cylindryczny B, średni", "img": "https://www.apsoparts.com/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/72/70/297270.jpg", "paths": {"pl-PL": "12203403-apsovibr-amortyzator-cylindryczny-b-sredni.html"}}]}});
  // a Magento address the engine on Railway cannot have filled ({{store url}} is filled only inside a CMS page): the
  // store view's own search, from the address
  if (/\{\{/.test(TXT.search || "")) TXT.search = "/" + (location.pathname.split("/")[1] || "en-INT") + "/catalogsearch/result/";
  var hint = root.querySelector(".apbf-ticket-hint");
  function say(text) { if (hint) hint.textContent = text; }

  // The better picture, once it is uploaded to the shop's media folder; until then the one in the block stays.
  var art = root.querySelector("img.apbf-art"), HQ = "/media/wysiwyg/bf26-percent.png";
  if (art && window.fetch) fetch(HQ, { method: "HEAD", cache: "no-store" }).then(function (r) {
    if (!r.ok || !/image\/png/i.test(r.headers.get("content-type") || "")) return;
    var url = HQ + "?v=" + encodeURIComponent(r.headers.get("last-modified") || "1"), hq = new Image();
    hq.onload = function () { if (hq.naturalWidth) art.src = url; };
    hq.src = url;
  }).catch(function () {});

  // Same width as the shop's search bar on desktop; without it the CSS keeps the shop's 1170px container.
  function fit() {
    var bar = document.getElementById("search_mini_form");
    var r = bar && window.innerWidth >= 768 ? bar.getBoundingClientRect() : null;
    if (!r || r.width < 600) { root.style.cssText = ""; return; }
    var p = root.parentNode.getBoundingClientRect();
    root.style.maxWidth = r.width + "px";
    root.style.marginLeft = (r.left - p.left) + "px";
    root.style.paddingLeft = root.style.paddingRight = "0";
  }
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(document.body); else window.addEventListener("resize", fit);

  // Log in returns to this page (Magento reads "referer" as URL-safe base64).
  var login = document.getElementById("apbf-login");
  if (login && window.btoa) {
    var ref = btoa(location.href.split("#")[0]).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ",");
    login.href = login.href.replace(/\/?$/, "/") + "referer/" + ref + "/";
  }

  // Countdown to the start, then to the end.
  var start = Date.parse(root.getAttribute("data-start")), end = Date.parse(root.getAttribute("data-end"));
  var label = root.querySelector(".apbf-count-label"), boxes = root.querySelectorAll(".apbf-count-box b");
  var count = root.querySelector(".apbf-count"), ended = root.querySelector(".apbf-ended");
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function tick() {
    var now = Date.now(), target = now < start ? start : end;
    if (now >= end) {
      count.style.display = "none"; ended.style.display = "block";
      root.classList.add("is-ended"); say(TXT.ended);        // the same for everybody, signed in or not
      return false;
    }
    label.textContent = root.getAttribute(now < start ? "data-starts" : "data-ends");
    var s = Math.max(0, Math.floor((target - now) / 1000));
    var v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    for (var i = 0; i < 4; i++) boxes[i].textContent = i ? pad(v[i]) : v[i];
    return true;
  }
  if (tick()) setInterval(tick, 1000);

  /* ── after login: this company's own code, from the Ads Gateway ─────────────────────────────────── */
  // The signed-in customer as the shop keeps it (the search bar reads the same): only salted hashes leave the browser.
  var SALT = "apso-bb1:";
  function customer() {
    try {
      var c = JSON.parse(localStorage.getItem("mage-cache-storage") || "{}").customer;
      if (c && (c.email || (c.tracking && c.tracking.id))) return c;
    } catch (e) {}
    return null;
  }
  function signedIn() {
    if (customer()) return true;
    try { if (document.querySelector('a[href*="/customer/account/logout"]')) return true; } catch (e) {}
    return false;
  }
  function sha256(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function show(a) {
    var t = el("div", "apbf-ticket apbf-ticket--open");
    var top = el("div", "apbf-part apbf-cut-b apbf-ticket-top");
    var brand = el("div", "apbf-ticket-brand", "APSOparts · ");
    brand.appendChild(el("b", null, "Black Friday"));
    top.appendChild(brand);
    top.appendChild(el("div", "apbf-value", TXT.pct.replace("{n}", a.discount)));
    top.appendChild(el("div", "apbf-value-txt", TXT.value_txt));
    var row = el("div", "apbf-part apbf-cut-t apbf-code-row");
    row.appendChild(el("div", "apbf-code-title", TXT.code_title));
    row.appendChild(el("span", "apbf-code", a.code));
    var b = el("button", "apbf-copy", TXT.copy);
    b.type = "button";
    b.addEventListener("click", function () {
      function done() { b.textContent = TXT.copied; }
      if (navigator.clipboard) navigator.clipboard.writeText(a.code).then(done, done); else done();
    });
    row.appendChild(b);
    row.appendChild(el("div", "apbf-how", TXT.how));
    t.appendChild(top);
    t.appendChild(row);
    var slot = document.getElementById("apbf-slot");
    slot.innerHTML = "";
    slot.appendChild(t);
    // Magento's codes run to 17 characters: one line, made smaller until it fits the box
    var c = t.querySelector(".apbf-code"), fs = 28;
    while (c.scrollWidth > c.clientWidth && fs > 14) { fs--; c.style.fontSize = fs + "px"; }
    root.classList.add("is-unlocked");
    root.querySelector(".apbf-lead").textContent = TXT.unlocked;
  }

  // The company's code went into an order already (a colleague, or this buyer): no code to copy, the day it was used.
  function day(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return "–";
    try { return new Date(t).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }); }
    catch (e) { var d = new Date(t); return d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear(); }
  }
  function showUsed(a) {
    var t = el("div", "apbf-ticket apbf-ticket--open apbf-ticket--used");
    var top = el("div", "apbf-part apbf-cut-b apbf-ticket-top");
    var brand = el("div", "apbf-ticket-brand", "APSOparts · ");
    brand.appendChild(el("b", null, "Black Friday"));
    top.appendChild(brand);
    top.appendChild(el("div", "apbf-used-mark", "✓"));
    top.appendChild(el("div", "apbf-ticket-label", TXT.used_title));
    t.appendChild(top);
    t.appendChild(el("div", "apbf-part apbf-cut-t apbf-ticket-foot apbf-used-msg", TXT.used_msg.replace("{date}", day(a.used_at))));
    var slot = document.getElementById("apbf-slot");
    slot.innerHTML = "";
    slot.appendChild(t);
    root.classList.add("is-unlocked");
    root.querySelector(".apbf-lead").textContent = TXT.used_lead;
  }

  // Before the start the card slides from "your code appears here from ..." through our ten best-selling products.
  // A product opens its page in this store view; on ACC, or a store view not listed, the shop's search for one of its
  // articles finds it instead.
  var sv = location.pathname.split("/")[1] || "", onAcc = /^acc\./.test(location.hostname);
  function slides() {
    var top = root.querySelector(".apbf-ticket-top");
    if (!top || top.querySelector(".apbf-track")) return;
    var first = el("div", "apbf-slide");
    while (top.firstChild) first.appendChild(top.firstChild);
    var track = el("div", "apbf-track"), view = el("div", "apbf-slides"), pager = el("div", "apbf-pager");
    track.appendChild(first);
    TXT.top.forEach(function (t) {
      var sl = el("div", "apbf-slide");
      var brand = el("div", "apbf-ticket-brand", "APSOparts \u00b7 ");
      brand.appendChild(el("b", null, "Black Friday"));
      sl.appendChild(brand);
      sl.appendChild(el("div", "apbf-until", TXT.until));
      sl.appendChild(el("div", "apbf-until-txt", TXT.best));
      var img = el("img", "apbf-art-img");
      img.src = t.img; img.alt = t.name; img.width = 116; img.height = 116;
      sl.appendChild(img);
      sl.appendChild(el("div", "apbf-art-name", t.name));
      var go = el("a", "apbf-shop", TXT.view + " \u2192");
      go.href = t.paths[sv] && !onAcc ? "/" + sv + "/" + t.paths[sv] : TXT.search + "?q=" + encodeURIComponent(t.sku);
      sl.appendChild(go);
      track.appendChild(sl);
    });
    view.appendChild(track); top.appendChild(view);
    var n = track.children.length, dots = [];
    for (var j = 0; j < n; j++) { dots.push(el("i", j ? null : "on")); pager.appendChild(dots[j]); }
    top.appendChild(pager);
    var k = 0, paused = false;
    top.addEventListener("mouseenter", function () { paused = true; });
    top.addEventListener("mouseleave", function () { paused = false; });
    (function next() {
      setTimeout(function () {
        if (!paused) {
          dots[k].className = ""; k = (k + 1) % n; dots[k].className = "on";
          track.style.transform = "translateX(" + (-100 * k) + "%)";
        }
        next();
      }, k === 0 ? 4000 : 2800);
    })();
  }

  // "Register now" here: the account that comes back signed in counts as a sign-up from this page (3 days)
  var reg = root.querySelector(".apbf-btn-primary");
  if (reg) reg.addEventListener("click", function () { try { localStorage.setItem("apbf_signup", String(Date.now())); } catch (e) {} });
  function cameToSignUp() {
    try { return Date.now() - Number(localStorage.getItem("apbf_signup") || 0) < 3 * 86400000 ? 1 : 0; } catch (e) { return 0; }
  }

  // The gateway answers at once; if it cannot (HubSpot slow, a restart), the page asks again quietly - no error text.
  var tries = 0;
  function ask(h, i, d) {
    tries++;
    say(TXT.wait);
    function again() { if (tries < 20) setTimeout(function () { ask(h, i, d); }, 15000); }
    fetch(TXT.gateway, {
      method: "POST", mode: "cors", credentials: "omit", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ h: h, i: i, d: d, s: cameToSignUp(), v: 2 })
    }).then(function (r) { return r.json(); }).then(function (a) {
      if (a.state === "ok" && a.code && a.discount) return show(a);
      if (a.state === "used") return showUsed(a);
      if (a.state === "soon" || a.state === "off") { say(TXT.soon); return slides(); }
      if (a.state === "ended") { root.classList.add("is-ended"); return say(TXT.ended); }
      if (a.state === "refused") return;
      again();
    })["catch"](again);
  }

  // Before the start everybody gets the carousel, signed in or not (SARCLA 04.11.2026: "the countdown, also with the carousel")
  if (Date.now() < start) slides();

  // The shop fills its customer data a moment after the page loads: wait for it (signed in: up to a minute).
  var waited = 0;
  (function wait() {
    if (Date.now() >= end) return;                         // ended: nothing to unlock
    var c = customer();
    if (!c || !c.email) {
      if (waited < 60 && (signedIn() || waited < 3)) { waited++; return setTimeout(wait, 1000); }
      return;
    }
    if (!(window.crypto && crypto.subtle && window.fetch && window.TextEncoder)) return;
    root.classList.add("is-signed-in");
    var email = String(c.email).trim().toLowerCase();
    var domain = email.split("@")[1] || "";                 // the domain only, to place a brand-new account at once
    var ip = c.tracking && c.tracking.id ? sha256(SALT + "id:" + c.tracking.id) : Promise.resolve("");
    Promise.all([sha256(SALT + email), ip]).then(function (k) { ask(k[0], k[1], domain); });
  })();
})();
})();
