//#region src/index.ts
/**
* @PeterBon/dsh-hooks-ui — host half: deliberately minimal. The /dsh-hooks/*
* routes this panel's browser half consumes are registered by the dsh-hooks
* core plugin (soft-probed against the shared webServer), so the host side
* only needs to exist as a valid plugin row. The dsh.client declaration in
* package.json loads the browser half in the web GUI.
*/
const name = "@PeterBon/dsh-hooks-ui";
function apply() {}
//#endregion
export { apply, name };
