// THE COMPASS CONNECTOR IS RETIRED. The hub runs the whole Compass sync since 10.10.2026
// (first full chain: 14 files, 13 steps, 0 failed), and SARCLA had the Railway service
// stopped the same day: "take it out completely ... let it die in Railway" - a backup
// bundle of it comes later. So the hub no longer asks it anything: every step is the
// hub's to run, the ERP's files are the hub's to pull, and the pages read the hub's own
// records. The HUB_STEPS hand-over (steps/run.ts) stays in the code for the record, but
// with this set it answers "the hub runs everything" without a call.
export const CONNECTOR_RETIRED = true;
