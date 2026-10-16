# Contribuir

## Cuando la API cambia

1. Confirma el cambio contra la documentación pública (https://cotizave.com/docs) o el
   equipo de Cotizave. La skill solo describe comportamiento público.
2. Actualiza la referencia afectada en `skills/cotizave/references/` y, si cambia una
   decisión ("qué endpoint uso", una trampa frecuente), `SKILL.md`.
3. Si cambia la forma de una respuesta o de un error, actualiza el fixture en
   `skills/cotizave/assets/fixtures/`. Registra fuente y fecha del contrato; no
   declares validación del backend sin evidencia ni uses producción para los tests.

## Validar y probar

```bash
node scripts/validate.mjs              # estático, sin dependencias
node --test scripts/*.test.mjs
node scripts/smoke-install.mjs         # copia instalable, recursos y enlaces
node scripts/smoke-install.mjs --codex # opcional: Codex CLI, sin inferencia
```

El test de términos no publicables se salta si no defines `FORBIDDEN_TERMS_FILE`.
`validate.mjs` falla si encuentra una key con formato real, detalles internos de la
infraestructura o planes que no están a la venta: la skill es pública.

## Evaluar el comportamiento

`evals/` describe cómo comprobar que un agente usa bien la skill (con y sin ella). Si
cambias una regla de `SKILL.md` o de una referencia, agrega o ajusta el escenario que
la cubre y repite la comparación. Ver [evals/README.md](evals/README.md).

## Versionado

- SemVer en `metadata.version` de `SKILL.md`, que debe coincidir con
  `metadata.version` y `plugins[].version` de `.claude-plugin/marketplace.json`
  (`validate.mjs` lo exige).
- `MAJOR`: cambia una regla que haría que el código ya generado por agentes quede
  incorrecto. `MINOR`: endpoints o guías nuevas. `PATCH`: correcciones.
- Registra cada versión en `CHANGELOG.md` (Keep a Changelog).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), en español:
`fix(skill): /route es solo Escala`, `feat(skill): trampa de feriados del BCV`,
`docs(readme): instalación en Cursor`.

## Límites de las validaciones

El validador local no implementa todo YAML: admite strings sin ambigüedad, strings
entre comillas, bloques `>-`/`|-` de líneas consecutivas indentadas dos espacios y
un mapa `metadata` de strings. Rechaza duplicados y sintaxis no soportada. Es una
convención del repositorio, no una restricción del estándar Agent Skills. Para
validar otras formas YAML, usa además el validador oficial en un entorno que ya lo tenga.

Los tests de `check-key.sh` usan exclusivamente loopback y credenciales ficticias;
requieren Bash, curl 8.4+ y jq. Los tests de scripts no prueban el comportamiento de
un agente. Las fixtures son ejemplos de contrato, no capturas certificadas de producción.
Los hashes de términos no publicables detectan errores editoriales, no protegen
secretos de baja entropía; no los uses como mecanismo de confidencialidad.
