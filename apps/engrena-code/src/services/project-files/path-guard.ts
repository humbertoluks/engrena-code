/**
 * Guarda de path de arquivo do projeto — compartilhada entre a camada HTTP (viewer/menções) e o
 * runner (anexos de contexto do composer). Fica fora de `http/` porque o runner não pode importar
 * um handler sem inverter as camadas.
 */
import { isAbsolute, normalize, resolve, sep } from 'node:path'

/**
 * Resolve um path relativo seguro dentro da raiz do projeto.
 * Retorna null + código de erro quando inválido.
 */
export function resolveProjectFilePath(
  root: string,
  rawPath: string,
): { ok: true; absPath: string; relPath: string } | { ok: false; code: string; message: string } {
  const trimmed = rawPath.trim()
  if (trimmed.length === 0) {
    return { ok: false, code: 'validation_error', message: 'path é obrigatório.' }
  }
  const normalized = normalize(trimmed)
  if (isAbsolute(trimmed) || normalized === '..' || normalized.startsWith(`..${sep}`)) {
    return { ok: false, code: 'validation_error', message: 'Caminho de arquivo inseguro.' }
  }
  const relPosix = normalized.split('\\').join('/')
  if (relPosix === '.git' || relPosix.startsWith('.git/')) {
    return { ok: false, code: 'validation_error', message: 'O diretório .git não é acessível.' }
  }
  const absPath = resolve(root, normalized)
  const rootResolved = resolve(root)
  if (absPath !== rootResolved && !absPath.startsWith(`${rootResolved}${sep}`)) {
    return { ok: false, code: 'validation_error', message: 'Caminho fora do projeto.' }
  }
  return { ok: true, absPath, relPath: relPosix }
}
