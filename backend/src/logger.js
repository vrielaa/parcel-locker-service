export function maskToken(token) {
  if (!token) return null

  const tail = token.slice(-8)
  return `***${tail}`
}

const safeError = (err) => {
  if (!err) return null

  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  }

  return { message: String(err) }
}

const normalizeMeta = (meta) => {
  if (!meta || typeof meta !== "object") return {}

  const out = { ...meta }

  if (typeof out.token === "string") {
    out.token = maskToken(out.token)
  }

  if (out.error) {
    out.error = safeError(out.error)
  }

  return out
}

const writeLog = (level, message, meta) => {
  const payload = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...normalizeMeta(meta)
  }

  if (level === "ERROR") {
    console.error(JSON.stringify(payload))
    return
  }

  if (level === "WARN") {
    console.warn(JSON.stringify(payload))
    return
  }

  console.log(JSON.stringify(payload))
}

export function logInfo(message, meta = {}) {
  writeLog("INFO", message, meta)
}

export function logWarn(message, meta = {}) {
  writeLog("WARN", message, meta)
}

export function logError(message, meta = {}) {
  writeLog("ERROR", message, meta)
}
