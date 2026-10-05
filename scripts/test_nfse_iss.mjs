import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/nfse-iss.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } });
const { buildNfseIss } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
const municipal = { tribISSQN: 1, tpRetISSQN: 1, cLocIncid: "4108809", pAliq: 2.01, vISSQN: 0 };
const national = { provedor: "nfse-nacional", nacional: { opcao_simples_nacional: "3", regime_apuracao_simples: "1", tributacao_issqn: "1", retencao_issqn: "1" } };

// The municipality adapter retains its existing request contract.
assert.deepEqual(buildNfseIss({ provedor: "guaira-ipm" }, municipal, null), municipal);
// National SN without withholding must not inherit the old zero or fallback rate.
assert.deepEqual(buildNfseIss(national, municipal, 2.01), { tribISSQN: 1, tpRetISSQN: 1, cLocIncid: "4108809" });
assert.deepEqual(buildNfseIss(national, municipal, 0), { tribISSQN: 1, tpRetISSQN: 1, cLocIncid: "4108809" });
const mei = { ...national, nacional: { ...national.nacional, opcao_simples_nacional: "2", regime_apuracao_simples: null } };
assert.equal(Object.hasOwn(buildNfseIss(mei, municipal, 5), "pAliq"), false);
const retained = { ...national, nacional: { ...national.nacional, retencao_issqn: "2" } };
assert.throws(() => buildNfseIss(retained, municipal, undefined), /alíquota efetiva/);
assert.throws(() => buildNfseIss(retained, municipal, 0), /alíquota efetiva/);
assert.throws(() => buildNfseIss(retained, municipal, 1.79), /alíquota efetiva/);
assert.deepEqual(buildNfseIss(retained, municipal, 2.01), { tribISSQN: 1, tpRetISSQN: 2, cLocIncid: "4108809", pAliq: 2.01 });
const immunity = { ...national, nacional: { ...national.nacional, tributacao_issqn: "2" } };
assert.deepEqual(buildNfseIss(immunity, municipal, 2.01), { tribISSQN: 2, tpRetISSQN: 1, cLocIncid: "4108809" });
assert.throws(() => buildNfseIss({ provedor: "nfse-nacional" }, municipal, 2.01), /Configuração NFS-e Nacional incompleta/);
console.log("NFS-e ISS: 10 verificações de regressão passaram; nenhuma transmissão fiscal realizada.");
