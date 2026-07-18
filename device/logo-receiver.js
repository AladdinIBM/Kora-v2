export function receiveDynamicLogo(file, onTransferred) {
  const params = file && file.params
  if (
    !file ||
    !params ||
    params.type !== 'clubpulse-logo' ||
    !params.teamId ||
    !params.sourceUrl ||
    typeof onTransferred !== 'function'
  ) {
    return false
  }

  let completed = false
  const finish = () => {
    if (completed || !file.filePath) {
      return
    }
    completed = true
    onTransferred({
      teamId: String(params.teamId),
      sourceUrl: String(params.sourceUrl),
      localPath: file.filePath,
    })
  }

  if (file.readyState === 'transferred') {
    finish()
    return true
  }

  file.on('change', (event) => {
    if (event?.data?.readyState === 'transferred') {
      finish()
    }
  })
  return true
}
