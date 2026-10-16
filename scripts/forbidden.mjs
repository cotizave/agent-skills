// forbidden.mjs — detector de términos no publicables, sin la lista en claro.
//
// La skill es pública: no puede nombrar detalles internos (infraestructura,
// proveedores, procesos internos, rutas privadas ni planes fuera de venta). Este
// archivo tampoco puede nombrarlos, así que solo guarda el SHA-256 de cada término
// normalizado. Un término puede ser una palabra, una expresión de 2 o 3 palabras
// separadas por un espacio, o "q:<palabra>" (la palabra entre comillas o backticks).
//
// Normalización: NFKD sin diacríticos y en minúsculas. Un token es una secuencia de
// letras, dígitos y `.`, `/`, `_`, `-`. De cada token se revisan también sus tramos
// (p. ej. `a.b.c` → `a.b`, `b.c`, `b`; `/x/y/z` → `/x/y`, `y`), y del texto, cada
// par y trío de tokens consecutivos.
//
// Para agregar un término: calcula su hash con
//   node -e 'console.log(require("node:crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' "<término normalizado>"
// y pégalo abajo. Nunca escribas el término en claro en el repo (ni en tests,
// fixtures, comentarios o CHANGELOG).
import { createHash } from "node:crypto";

export const FORBIDDEN_HASHES = new Set([
  "042e9398f2cc89025595d077503121a4a5a41d153d6863caa4c7332c8f1029f6",
  "053ea4804ef1bb33d4a3d6fb024a614b6d257cebc2bc7cd915da9c9522f37ffc",
  "0cf6855c1a3c323bfb9d788f7a55f0ce6cc765b2922c247c28ea21babf00c919",
  "12a089fd88451741afbab79d318127993abd74eae87f1056ab21e7b9abbf9085",
  "16fd3c9b3a28501f74ccd4742a24da9885a257f2d4fffc27bb07dc49c099ba43",
  "1712b1ab18de3fa7cb2ab4fae5968962881b6ccb021f2c5bff8ec0af2318a697",
  "1809f7cd0c75acf34f56d8c19782b99c6b5fcd14128a3cc79aca38a4f94af3ff",
  "199c9c3671f26ae51c2bdb16ec647266ab8e2a7d7f40bd29e55e43d72add1a31",
  "1cc9a79bdaf09793062750a17e559d40d5c0f1372cc859f67fe1081e6bc8a307",
  "2449bd07ae3190d0c66b4e6221d4bf68d3234ce4868b65aa83b34267e92b639e",
  "2ae288694b3ba9fef60e5af9f4067b2fa80712e1bfe727ac5506b0c47b14f3b0",
  "2b1e5cc3ce0b509f7160a7fcbd98810fc7a5708b509b88b97876303e7a1ad9f4",
  "302a4867892ab12686cccbbc5d0b0da44163ef05bda881adbbc73fd03fe3a2b3",
  "34fb46c847bb9df96e5205a39d382f648a6e8dce1e014cd85b4ca6a88d88ed03",
  "37039d17eea55bacf24ec7cd8679f42fb059f803bd487cdcb5c21e18ccc0926e",
  "3935db5cad75ae8365295b4aad1d65cd0ef35345878cab265a216abada8c8800",
  "3ed57e967c641e65eee45c262c92a4969c1864ddc57a6a2d9a11384d54153d38",
  "443f1584967be1347d9083c7cb58ee5e7958e3c7a03a3c07de0625ee5bdf10b5",
  "487b91042c7cf27a19e23ea8699f5f354b1a0c3af9e418138dc6150d830f970d",
  "4ea6bd7e31d50ee03f142fbad1aad662bd3a6c2f1d7a61e3326e96a3f795df45",
  "511c48ed2c870815b90f5fff9308bc9f17c37ce4eef46934b96e15ec66f85b9e",
  "56eb5f24b91554afe56820ed48a0199b528a328cdeb0212f20fab4757b6f2bd4",
  "57875c8d4895b756d401edb79d9361452315168df5d7e4a010830b4fe25f58f1",
  "5b8aee8d784120382314f99b140baa7146360aa8806082b631460b548f0401e6",
  "5d72436256ada53828b51895a94bb8489e9f1ac4fe937a8024ef1594e7045ff6",
  "5f79a857e2bf1fd8c30a1ed8607677880132e0cc598da94f001bb5f243d89167",
  "626c6954637cf4b6d916be402cabe3b83b7ef1bb7f06c5a424d86b79e091aa22",
  "635ef97e2b6e87d73e76801edaac6ca9e2600ce255be4bfbc3ac92a75489765f",
  "660f7078dc0b381a350960eae8f3e924e739994dd8657dcc0d270a28c6ff8a38",
  "6679360708ec87ce6b9054ec66fb65a588704366e7b640716507620e9aced21e",
  "690f6199a0c257b3c52cf180943cda74a37577e2216e819068f400fd9d6fbd9b",
  "6c121dce030f5bd6861d0b0ec4a8f4bdaea1c979b34c3719a1fb191777fa07e6",
  "6de1be36afd7a16d2e4fb5043e9214d437f65e48eacaaf9f3ab284bc62c0dd06",
  "7051e4fcc7f8fc5364d9e16b9bd509670712be40391cdf405b1a690f914e94bd",
  "71f35f5d195c7f67599ea8436e4584cc35f408529489ee3e05722061837708c9",
  "72721e959f5df50d08529fff914069476a283ad1518ea87860f62f556442c50c",
  "72930689225d8795dedeb78dd79c87cf8a5b3a88723e24b89b28df6449716b18",
  "738e22f0acab814cc0c6a9dfdd1c6a193ea278e48b07f070784d608243e68d8c",
  "7488d73850bf2009e6762d270ba53bb4e2f88ec77d3dcebeeed21ebac43dca24",
  "7708483f479338d2fbf04be9e7e16bfec787322723d382b903beaaee6af0eb25",
  "785c94ad5dac24a8205f0e7dd21cabeafec4371cbdd0bffb0300644ab93381f7",
  "7c09b62405a2c0917f8b7440599ce947d2dc40bc8ece294d8be99fd808b593f0",
  "7f871cbf905f6e0cd598b11609f33f609e60a61892ac6b37e80cf1de282ee367",
  "81a250e125f325b568d9746f903baeab2229fbe1418b77b71a78efb9ad0fe2c6",
  "826027eeab7de2ef7f925e51dcb4cc248adff915d8f07ad40b3c0a16eb765f47",
  "863cc55efc461f1557a815c8fabf5919a9cf30b04db51c1628c330fff5cda277",
  "8be539dafaf36cdeb6a8267c4de65215a47ad325b484cc351eb195c620f4fe6e",
  "8c6dd2663599bee209296221eda13df90e45b14ee9ef9082191da0056abe1182",
  "93817d0fbe4de5dcbc4e0e51345091fbce164fa13f7ce87a9ef13a9fb7e8d227",
  "9669ade1f2c135088997764efd17b565655a58e9dc008501689634117cc50f91",
  "96a94ad1c6626c7b5a7e096c65b5e998436d2c2ef7cd0ed15cc8ac4fd2b1c01f",
  "974aa836691d1f761e4955cedadabc35e27620a9492b10b67d82c7971db0608e",
  "99d211b2dd6f2f4ff227e4128c27483d93823c9cd294a297df7b211455075d68",
  "9f48536f56a134dfc40f591941dda59d5abe0926421e768a1c595781dc049a2a",
  "9fd09dc33545f9cc19b81ebd0b98c4fd8c66ed1e34de89f4c9a81e6b26dc0d54",
  "a478b4566be5cb007a5d8ae532c7eeac2cd3be26ad639a65c1dd11b3bf95c51b",
  "a58f0473fb4c182db5a53fe978863b6eaa6552b5c694769ae3965d25bb11be76",
  "a942b37ccfaf5a813b1432caa209a43b9d144e47ad0de1549c289c253e556cd5",
  "aa580e62b7416f64c9a7e0da8d652d98aaf91e14554141d60ad49a50783a3cbc",
  "ab64f853e87903c2da432c6c6e9a48962bdf9cc1624341d2494cb88ad632f01f",
  "ae7936c81deaf124b498713eca371b53da22903b21a6a0f4cedbeda973887a8f",
  "b4bbca6caf5247626ee41b68231d40e1c1977ec9c3d0fc26b6809e1c703ca2b7",
  "b535447b694adbd768e5fdaf63c25a05beef64953de99f329367361c922a75b2",
  "ba1c464e18573b1f54a78563d8c3a4eeadb817db5cd7fb8d626456783369f0e2",
  "bd5e030e94014b5d2ce8c21a66d22d5f9979e72b207f9e10f9160a01cfb07031",
  "c1f1a8edb17ec60d48146c91489655f23bc304bef272c526e3d11f2b5bf7f25c",
  "c41aaf739d7d04382cd8978d8b6247d664e51ae51ee024a9a3d76193f9f8d1f0",
  "c828c871ca37852f8238bff4e9296e548e44f757edb98fae35c2da9f7395eb35",
  "c9ae2918df24d39a9a59a22eeadb59095c7e9a742d8f030b5fe96c7c88f8d7b8",
  "cace491b69555e8d0f77747d47ae54e31ce4cc322fe51a7bdcf64402f3676ebf",
  "cdc91c1db8633abaa911218ad5ccfa7ccfbaff20921a9634d0fa64664f12b6af",
  "d1f5f102a165c74e546e95ea4127c36c16b6111093a8cbe14dcb1ae308dd2af0",
  "d9cd54190cf72b7d63160fb348e2b13b45a50346852f064db38fda3ae5c8321b",
  "da1a56de9e0b5cb0918d6d105fe9d0f55a32170503b124af79fc68889997b7c4",
  "dbb67027ea1aa433a3a9a8199564a4ba4e127ea78f574f9efdc0c05edf6df1bc",
  "dc436b329f4da6c88b0b6ce79d829ac4fc33746b454604e2bcbad25a8e2985fe",
  "dd0bfb19e8a368cceea4f2b92e16fa6cfb93e5fc82108a6d41f907694cb4348b",
  "de2187af3fb011708ca4ff6d21e4845236d6a6d25e7e90531b26a7923d16c73f",
  "dead3bb6d87c7e0f3dceb1fccdae03024cdd47ab0ef53d9e3573bacd48e2ea28",
  "e1e8bb0d89cf07e596849172067ff36e38edb81430f86d314b9da9ce73e511d2",
  "e34d1c9011e06204d0540f17e6370d18d2163d69944a3b43b5c92d68d89096fe",
  "e4a62135234f1b52a2129208a84575131e38a0b478c843c0fc9ad44ff54f8de6",
  "f07f4dd42ff58e68db110e23ccca893ba22042f1b895d5e0db0f248c23d3533d",
  "f1aed2a42e8ddfcc39d3e64eeb8fa9a71a6db3580855b3b3e03d7dcc62c6cfff",
  "f77e8e3220010288248f53eb5e26004c245f312dfe95b872f146bf844b2db6e8",
  "f84a33cfa8eb8c665557c670eed724fdfecfd6b64e35ced94aed6f4db10cf406",
  "fb2b822fad5c727f0a2b20687bf6986755cb744135cca425cd9ed268cb0cfb62",
]);

const MAX_PARTS = 12;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function normalize(text) {
  return text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
}

/** Tramos contiguos de un token: `a.b/c` → `a`, `a.b`, `a.b/c`, `b`, `b/c`, `/c`, `c`… */
function spans(token) {
  const pieces = token.split(/([._/-])/); // palabra, separador, palabra, …
  const words = [];
  for (let i = 0; i < pieces.length; i += 2) words.push({ word: pieces[i], sepBefore: pieces[i - 1] ?? "" });
  const out = new Set([token]);
  const n = Math.min(words.length, MAX_PARTS);
  for (let i = 0; i < n; i++) {
    let run = "";
    for (let j = i; j < n; j++) {
      run += (j > i ? words[j].sepBefore : "") + words[j].word;
      if (!run) continue;
      out.add(run);
      if (words[i].sepBefore === "/") out.add("/" + run);
    }
  }
  return out;
}

/**
 * Devuelve [{ line, match }] con cada aparición de un término cuyo hash está en
 * `hashes`. `match` es el fragmento del texto analizado (no viene de esta lista).
 */
export function findForbidden(text, hashes = FORBIDDEN_HASHES) {
  const hits = [];
  const seen = new Set();
  const report = (line, match) => {
    const key = `${line}\u0000${match}`;
    if (!seen.has(key)) {
      seen.add(key);
      hits.push({ line, match });
    }
  };
  const tokens = [];
  normalize(text)
    .split("\n")
    .forEach((lineText, i) => {
      const line = i + 1;
      for (const [, word] of lineText.matchAll(/[`"']([\p{L}\p{N}._/-]+)[`"']/gu))
        if (hashes.has(sha256("q:" + word))) report(line, word);
      for (const [raw] of lineText.matchAll(/[\p{L}\p{N}._/-]+/gu)) {
        const token = raw.replace(/^[._-]+/, "").replace(/[._/-]+$/, "");
        if (!token) continue;
        tokens.push({ token, line });
        for (const s of spans(token)) if (hashes.has(sha256(s))) report(line, raw);
      }
    });
  for (let i = 0; i < tokens.length; i++) {
    for (const size of [2, 3]) {
      if (i + size > tokens.length) continue;
      const gram = tokens
        .slice(i, i + size)
        .map((t) => t.token)
        .join(" ");
      if (hashes.has(sha256(gram))) report(tokens[i].line, gram);
    }
  }
  return hits;
}
