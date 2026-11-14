// BLACK FRIDAY 2026 - THE VOUCHER MODULE'S DATA. Written by C:/dev/black-friday-2026/tools/gen_bf_page.py from the same
// texts as the pasted block and the engine on Railway - never edited by hand (run the generator again).

export const BF26_VOUCHER_START = "2026-11-15T23:00:00Z";
export const BF26_VOUCHER_END = "2026-12-06T23:00:00Z";
/** The engine: a file of the hub (public/), stored in the hub's own picture storage at Publish - its name is its hash.
 *  Its tag is the ONE script the hub lets through (src/lib/convert/trustedScripts.ts). */
export const BF26_VOUCHER_ENGINE = "/content/campaign/bf26/bf26-voucher-4a290e0a0136.js";
export const BF26_VOUCHER_TAG = "<script src=\"/content/campaign/bf26/bf26-voucher-4a290e0a0136.js\" defer></script>";
/** The block's CSS, every rule under the module's class (`@@`). */
export const BF26_VOUCHER_CSS = "@@ .apbf,@@ .apbf *{box-sizing: border-box;}\n@@ .apbf{--apbf-red: #ff0000; --apbf-red-ui: #e60000; --apbf-red-deep: #c40000; --apbf-ink: #000; --apbf-text: #2a2a2a; --apbf-mute: #666; --apbf-grey: #f3f3f3; max-width: 1170px; margin: 6px auto 44px; padding: 0 10px; color: var(--apbf-ink); font-family: \"futura-pt\", Arial, sans-serif; -webkit-user-select: none; user-select: none;}\n@@ .apbf.apbf-shell{max-width: none; margin: 0; padding: 0;}\n@@ .apbf-hero{position: relative; overflow: hidden; padding: 30px 48px 30px; border-radius: 4px; background: linear-gradient(135deg, #f8f8f8 0%, #eeeeee 50%, #e3e3e3 100%); display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 28px; align-items: center;}\n@@ .apbf-eyebrow{display: inline-flex; align-items: center; gap: 12px; font: 700 13px/1 \"futura-pt\", Arial, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--apbf-ink);}\n@@ .apbf-eyebrow::before{content: \"\"; width: 36px; height: 3px; background: var(--apbf-red);}\n@@ .apbf .apbf-word{margin: 14px 0 22px; padding: 0; font: 800 clamp(54px, 7.6vw, 104px)/.92 \"futura-pt\", \"Arial Black\", Arial, sans-serif; letter-spacing: -.01em; text-transform: none; color: var(--apbf-ink);}\n@@ .apbf .apbf-word span{display: block; padding-left: .5em; font-weight: 500; color: transparent; -webkit-text-stroke: 2px var(--apbf-ink);}\n@supports not (-webkit-text-stroke: 1px){@@ .apbf .apbf-word span{color: var(--apbf-ink);}}\n@@ .apbf .apbf-sub{margin: 0 0 10px; font: 700 clamp(22px, 2.3vw, 28px)/1.2 \"futura-pt\", Arial, sans-serif; color: var(--apbf-ink);}\n@@ .apbf .apbf-sub em{font-style: normal; color: var(--apbf-red);}\n@@ .apbf .apbf-lead{margin: 0 0 26px; max-width: 470px; font: 400 17px/1.5 \"futura-pt\", Arial, sans-serif; color: var(--apbf-text);}\n@@ .apbf-actions{display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px;}\n@@ .apbf a.apbf-btn,@@ .apbf a.apbf-btn:visited{display: inline-flex; align-items: center; gap: 10px; padding: 15px 24px; border-radius: 4px; font: 700 16px/1 \"futura-pt\", Arial, sans-serif; text-decoration: none; transition: background .15s, color .15s, box-shadow .15s;}\n@@ .apbf a.apbf-btn-primary{background: var(--apbf-red-ui); color: #fff;}\n@@ .apbf a.apbf-btn-primary:hover,@@ .apbf a.apbf-btn-primary:focus-visible{background: var(--apbf-red-deep); color: #fff;}\n@@ .apbf a.apbf-btn-ghost{background: #fff; color: var(--apbf-ink); box-shadow: inset 0 0 0 2px var(--apbf-ink);}\n@@ .apbf a.apbf-btn-ghost:hover,@@ .apbf a.apbf-btn-ghost:focus-visible{background: var(--apbf-ink); color: #fff;}\n@@ .apbf-btn svg{width: 18px; height: 18px;}\n@@ .apbf-count{display: flex; align-items: center; gap: 14px; flex-wrap: wrap;}\n@@ .apbf-count-label{font: 700 12px/1 \"futura-pt\", Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--apbf-mute);}\n@@ .apbf-count-boxes{display: flex; gap: 8px;}\n@@ .apbf-count-box{min-width: 60px; padding: 10px 8px 8px; border-radius: 4px; background: #fff; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 6px 16px -10px rgba(0,0,0,.25);}\n@@ .apbf-count-box b{display: block; font: 700 26px/1 \"futura-pt\", Arial, sans-serif; font-variant-numeric: tabular-nums; color: var(--apbf-ink);}\n@@ .apbf-count-box small{display: block; margin-top: 5px; font: 500 10px/1 \"futura-pt\", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--apbf-mute);}\n@@ .apbf-ended{font: 600 16px/1.4 \"futura-pt\", Arial, sans-serif; color: var(--apbf-text);}\n@@ .apbf-stage{position: relative; min-height: 420px;}\n@@ .apbf-art{position: absolute; top: -26px; right: -26px; width: 92%; max-width: 440px; height: auto; mix-blend-mode: multiply; pointer-events: none;}\n@@ .apbf-slot{position: relative; display: flex; justify-content: flex-start; padding: 104px 0 0 2%; filter: drop-shadow(0 22px 26px rgba(0,0,0,.2)) drop-shadow(0 2px 3px rgba(0,0,0,.08));}\n@@ .apbf-ticket{width: 100%; max-width: 300px; transform: rotate(-3deg); transition: transform .3s;}\n@@ .apbf-ticket:hover{transform: rotate(-1deg) translateY(-2px);}\n@@ .apbf-part{position: relative; background: #fff;}\n@@ .apbf-ticket > .apbf-part:first-child{border-radius: 8px 8px 0 0;}\n@@ .apbf-ticket > .apbf-part:last-child{border-radius: 0 0 8px 8px;}\n@@ .apbf-cut-b{-webkit-mask: radial-gradient(circle 12px at 0 100%, #0000 11px, #000 12px) left / 51% 100% no-repeat, radial-gradient(circle 12px at 100% 100%, #0000 11px, #000 12px) right / 51% 100% no-repeat; mask: radial-gradient(circle 12px at 0 100%, #0000 11px, #000 12px) left / 51% 100% no-repeat, radial-gradient(circle 12px at 100% 100%, #0000 11px, #000 12px) right / 51% 100% no-repeat;}\n@@ .apbf-cut-t{-webkit-mask: radial-gradient(circle 12px at 0 0, #0000 11px, #000 12px) left / 51% 100% no-repeat, radial-gradient(circle 12px at 100% 0, #0000 11px, #000 12px) right / 51% 100% no-repeat; mask: radial-gradient(circle 12px at 0 0, #0000 11px, #000 12px) left / 51% 100% no-repeat, radial-gradient(circle 12px at 100% 0, #0000 11px, #000 12px) right / 51% 100% no-repeat;}\n@@ .apbf-cut-t::before{content: \"\"; position: absolute; top: -1px; left: 18px; right: 18px; border-top: 2px dashed #d6d6d6;}\n@@ .apbf-ticket-top{padding: 24px 24px 22px; text-align: center;}\n@@ .apbf-ticket-brand{font: 700 11px/1 \"futura-pt\", Arial, sans-serif; letter-spacing: .18em; text-transform: uppercase; color: var(--apbf-ink);}\n@@ .apbf-ticket-brand b{color: var(--apbf-red); font-weight: 700;}\n@@ .apbf-lock{width: 64px; height: 64px; margin: 18px auto 12px; border-radius: 50%; display: grid; place-items: center; background: var(--apbf-ink);}\n@@ .apbf-lock svg{width: 30px; height: 30px;}\n@@ .apbf-ticket-label{font: 700 17px/1.2 \"futura-pt\", Arial, sans-serif; color: var(--apbf-ink);}\n@@ .apbf-dots{margin: 12px auto 8px; padding: 12px 10px; border: 2px dashed #cfcfcf; border-radius: 6px; background: var(--apbf-grey); font: 700 22px/1 \"futura-pt\", Arial, sans-serif; letter-spacing: .35em; color: #bdbdbd; user-select: none;}\n@@ .apbf-ticket-hint{font: 500 14px/1.3 \"futura-pt\", Arial, sans-serif; color: var(--apbf-red-ui);}\n@@ .apbf-ticket-foot{padding: 15px 20px 17px; text-align: center; font: 600 12px/1.2 \"futura-pt\", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--apbf-mute);}\n@@ .apbf-ticket--open{transform: rotate(-2deg);}\n@@ .apbf-value{margin: 14px 0 0; font: 800 76px/1 \"futura-pt\", \"Arial Black\", Arial, sans-serif; letter-spacing: -.02em; color: var(--apbf-red);}\n@@ .apbf-value-txt{margin-top: 4px; font: 700 19px/1.2 \"futura-pt\", Arial, sans-serif; color: var(--apbf-ink);}\n@@ .apbf-code-row{padding: 20px 22px 18px; text-align: center;}\n@@ .apbf-code-title{margin-bottom: 10px; font: 600 12px/1 \"futura-pt\", Arial, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: var(--apbf-mute);}\n@@ .apbf-code{display: block; padding: 13px 10px; border: 2px dashed var(--apbf-red-ui); border-radius: 6px; background: var(--apbf-grey); font: 700 28px/1 \"futura-pt\", Arial, sans-serif; letter-spacing: .1em; color: var(--apbf-ink); -webkit-user-select: all; user-select: all; white-space: nowrap; overflow: hidden;}\n@@ .apbf button.apbf-copy{display: block; width: 100%; margin-top: 12px; padding: 14px; border: 0; border-radius: 4px; cursor: pointer; background: var(--apbf-ink); color: #fff; font: 700 16px/1 \"futura-pt\", Arial, sans-serif; transition: background .15s;}\n@@ .apbf button.apbf-copy:hover,@@ .apbf button.apbf-copy:focus-visible{background: var(--apbf-red-ui);}\n@@ .apbf-slides{overflow: hidden;}\n@@ .apbf-track{display: flex; transition: transform .45s cubic-bezier(.65, 0, .35, 1);}\n@@ .apbf-slide{flex: 0 0 100%; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;}\n@@ .apbf-until{margin: 12px 0 2px; font: 800 22px/1.1 \"futura-pt\", \"Arial Black\", Arial, sans-serif; color: var(--apbf-ink);}\n@@ .apbf-until-txt{font: 500 13px/1.3 \"futura-pt\", Arial, sans-serif; color: var(--apbf-text);}\n@@ .apbf-art-img{display: block; width: 116px; height: 116px; margin: 10px auto 8px; object-fit: contain;}\n@@ .apbf-art-name{font: 700 14px/1.25 \"futura-pt\", Arial, sans-serif; color: var(--apbf-ink); min-height: 35px; display: flex; align-items: center; justify-content: center;}\n@@ .apbf a.apbf-shop,@@ .apbf a.apbf-shop:visited{display: block; width: 100%; margin-top: 10px; padding: 11px; border-radius: 4px; background: var(--apbf-ink); color: #fff; font: 700 14px/1 \"futura-pt\", Arial, sans-serif; text-decoration: none;}\n@@ .apbf a.apbf-shop:hover{background: var(--apbf-red-ui); color: #fff;}\n@@ .apbf-pager{display: flex; gap: 5px; justify-content: center; margin-top: 12px;}\n@@ .apbf-pager i{width: 6px; height: 6px; border-radius: 50%; background: #d3d3d3; transition: background .3s;}\n@@ .apbf-pager i.on{background: var(--apbf-red);}\n@media (prefers-reduced-motion: reduce){@@ .apbf-track{transition: none;}}\n@@ .apbf-how{margin-top: 12px; font: 400 13px/1.45 \"futura-pt\", Arial, sans-serif; color: var(--apbf-mute);}\n@@ .apbf-used-mark{width: 64px; height: 64px; margin: 18px auto 12px; border-radius: 50%; display: grid; place-items: center; background: var(--apbf-grey); box-shadow: inset 0 0 0 2px #d6d6d6; color: var(--apbf-mute); font: 700 30px/1 \"futura-pt\", Arial, sans-serif;}\n@@ .apbf-ticket-foot.apbf-used-msg{text-transform: none; letter-spacing: 0; font: 500 14px/1.4 \"futura-pt\", Arial, sans-serif; color: var(--apbf-text);}\n@@ .apbf-steps{display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 14px 0 0; padding: 0; list-style: none; counter-reset: apbf;}\n@@ .apbf-steps li{display: flex; align-items: center; gap: 14px; margin: 0; padding: 16px 20px; border-radius: 4px; background: var(--apbf-grey); font: 600 16px/1.3 \"futura-pt\", Arial, sans-serif; color: var(--apbf-ink); counter-increment: apbf;}\n@@ .apbf-steps li::before{content: counter(apbf); flex: 0 0 auto; font: 800 34px/1 \"futura-pt\", \"Arial Black\", Arial, sans-serif; color: var(--apbf-red);}\n@@ .apbf .apbf-small{margin: 14px 0 0; font: 400 13px/1.5 \"futura-pt\", Arial, sans-serif; color: var(--apbf-mute);}\n@@ .apbf.is-unlocked .apbf-actions,@@ .apbf.is-unlocked .apbf-locked-only{display: none;}\n@@ .apbf.is-signed-in .apbf-actions{display: none;}\n@@ .apbf.is-ended .apbf-actions,@@ .apbf.is-ended .apbf-locked-only{display: none;}\n@media (max-width: 900px){@@ .apbf-hero{grid-template-columns: 1fr; padding: 26px 22px 26px; gap: 8px;}\n@@ .apbf-stage{min-height: 0;}\n@@ .apbf-art{top: -10px; right: -16px; width: 290px;}\n@@ .apbf-slot{justify-content: center; padding: 120px 0 4px;}\n@@ .apbf-steps{grid-template-columns: 1fr;}}\n@media (max-width: 480px){@@ .apbf .apbf-word span{-webkit-text-stroke-width: 1.5px;}\n@@ .apbf-eyebrow{font-size: 12px; letter-spacing: .1em; gap: 10px;}\n@@ .apbf-eyebrow::before{width: 24px;}\n@@ .apbf a.apbf-btn{width: 100%; justify-content: center;}\n@@ .apbf-count-boxes{width: 100%;}\n@@ .apbf-count-box{min-width: 0; flex: 1;}\n@@ .apbf-art{width: 240px;}\n@@ .apbf-slot{padding-top: 104px;}}\n@media (prefers-reduced-motion: reduce){@@ .apbf-ticket,@@ .apbf a.apbf-btn,@@ .apbf button.apbf-copy{transition: none;}}";
export type Bf26VoucherText = { eyebrow: string; sub: string; hl: string; lead: string; register: string; login: string; starts: string; ends: string; ended: string; units: string[]; locked: string; hint: string; valid: string; steps: string[]; small: string };
export const BF26_VOUCHER_TEXT: Record<string, Bf26VoucherText> = {
 "de": {
  "eyebrow": "16. November – 6. Dezember 2026",
  "sub": "Ihr persönliches Black-Friday-Angebot.",
  "hl": "persönliches",
  "lead": "Melden Sie sich an – der persönliche Code Ihrer Firma wird direkt hier freigeschaltet.",
  "register": "Jetzt registrieren",
  "login": "Bereits Kunde? Anmelden",
  "starts": "Startet in",
  "ends": "Endet in",
  "ended": "Die Aktion ist beendet. Danke fürs Mitmachen!",
  "units": [
   "Tage",
   "Std",
   "Min",
   "Sek"
  ],
  "locked": "Ihr Code",
  "hint": "Wird nach dem Login freigeschaltet",
  "valid": "Gültig 16.11.–6.12.2026",
  "steps": [
   "Registrieren oder anmelden",
   "Ihr persönlicher Code erscheint hier",
   "Code im Warenkorb eingeben"
  ],
  "small": "Ein persönlicher Code pro Firma, einmal einlösbar. Für Bestellungen von 100 bis 3000 CHF/EUR. Gültig vom 16. November bis 6. Dezember 2026. Nicht mit anderen Aktionen kombinierbar."
 },
 "fr": {
  "eyebrow": "16 novembre – 6 décembre 2026",
  "sub": "Votre offre Black Friday personnelle.",
  "hl": "personnelle",
  "lead": "Connectez-vous : le code personnel de votre entreprise se débloque ici même.",
  "register": "S’inscrire maintenant",
  "login": "Déjà client ? Se connecter",
  "starts": "Commence dans",
  "ends": "Se termine dans",
  "ended": "L’offre est terminée. Merci de votre participation !",
  "units": [
   "jours",
   "h",
   "min",
   "s"
  ],
  "locked": "Votre code",
  "hint": "Débloqué après connexion",
  "valid": "Valable du 16.11 au 6.12.2026",
  "steps": [
   "Inscrivez-vous ou connectez-vous",
   "Votre code personnel s’affiche ici",
   "Saisissez le code dans le panier"
  ],
  "small": "Un code personnel par entreprise, utilisable une fois. Pour les commandes de 100 à 3 000 CHF/EUR. Valable du 16 novembre au 6 décembre 2026. Non cumulable avec d’autres offres."
 },
 "it": {
  "eyebrow": "16 novembre – 6 dicembre 2026",
  "sub": "La tua offerta Black Friday personale.",
  "hl": "personale",
  "lead": "Accedi: il codice personale della tua azienda si sblocca proprio qui.",
  "register": "Registrati ora",
  "login": "Sei già cliente? Accedi",
  "starts": "Inizia tra",
  "ends": "Termina tra",
  "ended": "L’offerta è terminata. Grazie per la partecipazione!",
  "units": [
   "giorni",
   "ore",
   "min",
   "sec"
  ],
  "locked": "Il tuo codice",
  "hint": "Si sblocca dopo l’accesso",
  "valid": "Valido dal 16.11 al 6.12.2026",
  "steps": [
   "Registrati o accedi",
   "Il tuo codice personale appare qui",
   "Inserisci il codice nel carrello"
  ],
  "small": "Un codice personale per azienda, utilizzabile una volta. Per ordini da 100 a 3.000 CHF/EUR. Valida dal 16 novembre al 6 dicembre 2026. Non cumulabile con altre promozioni."
 },
 "en": {
  "eyebrow": "16 November – 6 December 2026",
  "sub": "Your personal Black Friday offer.",
  "hl": "personal",
  "lead": "Log in and your company’s own code unlocks right here.",
  "register": "Register now",
  "login": "Already a customer? Log in",
  "starts": "Starts in",
  "ends": "Ends in",
  "ended": "The offer has ended. Thank you for joining in!",
  "units": [
   "days",
   "hrs",
   "min",
   "sec"
  ],
  "locked": "Your code",
  "hint": "Unlocks after login",
  "valid": "Valid 16 Nov – 6 Dec 2026",
  "steps": [
   "Register or log in",
   "Your personal code appears here",
   "Enter the code in your basket"
  ],
  "small": "One personal code per company, usable once. For orders from 100 to 3,000 CHF/EUR. Valid 16 November to 6 December 2026. Cannot be combined with other offers."
 },
 "nl": {
  "eyebrow": "16 november – 6 december 2026",
  "sub": "Uw persoonlijke Black Friday-aanbieding.",
  "hl": "persoonlijke",
  "lead": "Log in – de persoonlijke code van uw bedrijf wordt hier direct vrijgegeven.",
  "register": "Nu registreren",
  "login": "Al klant? Inloggen",
  "starts": "Start over",
  "ends": "Eindigt over",
  "ended": "De actie is afgelopen. Bedankt voor uw deelname!",
  "units": [
   "dagen",
   "uur",
   "min",
   "sec"
  ],
  "locked": "Uw code",
  "hint": "Vrijgegeven na inloggen",
  "valid": "Geldig 16.11–6.12.2026",
  "steps": [
   "Registreer of log in",
   "Uw persoonlijke code verschijnt hier",
   "Voer de code in het winkelmandje in"
  ],
  "small": "Eén persoonlijke code per bedrijf, eenmaal te gebruiken. Voor bestellingen van 100 tot 3.000 CHF/EUR. Geldig van 16 november t/m 6 december 2026. Niet te combineren met andere acties."
 },
 "pl": {
  "eyebrow": "16 listopada – 6 grudnia 2026",
  "sub": "Twoja osobista oferta Black Friday.",
  "hl": "osobista",
  "lead": "Zaloguj się – osobisty kod Twojej firmy odblokuje się właśnie tutaj.",
  "register": "Zarejestruj się teraz",
  "login": "Jesteś już klientem? Zaloguj się",
  "starts": "Start za",
  "ends": "Koniec za",
  "ended": "Promocja zakończona. Dziękujemy za udział!",
  "units": [
   "dni",
   "godz",
   "min",
   "sek"
  ],
  "locked": "Twój kod",
  "hint": "Odblokowany po zalogowaniu",
  "valid": "Ważny 16.11–6.12.2026",
  "steps": [
   "Zarejestruj się lub zaloguj",
   "Twój osobisty kod pojawi się tutaj",
   "Wpisz kod w koszyku"
  ],
  "small": "Jeden osobisty kod na firmę, do jednorazowego użycia. Dla zamówień o wartości od 100 do 3000 CHF/EUR. Ważne od 16 listopada do 6 grudnia 2026. Nie łączy się z innymi promocjami."
 }
};
