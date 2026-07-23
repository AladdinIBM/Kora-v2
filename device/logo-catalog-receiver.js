export function receiveCatalogLogo(file, onTransferred) {
  const params = file && file.params
  if (
    !file ||
    !params ||
    params.type !== 'clubpulse-logo-catalog' ||
    !params.season ||
    !params.teamId ||
    !params.revision ||
    typeof onTransferred !== 'function'
  ) {
    return false
  }

  let completed = false
  const finish = () => {
    if (completed || !file.filePath) return
    completed = true
    onTransferred({
      season: String(params.season),
      teamId: String(params.teamId),
      revision: String(params.revision),
      byteLength: Number(params.byteLength) || Number(file.fileSize) || 0,
      totalTeams: Number(params.totalTeams) || 0,
      localPath: file.filePath,
    })
  }

  if (file.readyState === 'transferred') {
    finish()
    return true
  }

  file.on('change', (event) => {
    if (event?.data?.readyState === 'transferred') finish()
  })
  return true
}
