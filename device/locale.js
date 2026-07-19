import { getText } from '@zos/i18n'
import {
  getDateFormat,
  getLanguage,
  getTimeFormat,
  DATE_FORMAT_DMY,
  DATE_FORMAT_MDY,
  TIME_FORMAT_12,
} from '@zos/settings'

const ARABIC_LANGUAGE_CODE = 13
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

const DAY_NAMES = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
}

const COMPACT_DAY_NAMES = {
  en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  ar: ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
}

const MONTH_NAMES = {
  en: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  ar: [
    'ينا',
    'فبر',
    'مار',
    'أبر',
    'ماي',
    'يون',
    'يول',
    'أغس',
    'سبت',
    'أكت',
    'نوف',
    'ديس',
  ],
}

export function isArabic() {
  return getLanguage() === ARABIC_LANGUAGE_CODE
}

export function isRtl() {
  return isArabic()
}

export function t(key) {
  const translated = getText(key)
  return translated || key
}

export function localizeDigits(value) {
  const text = String(value)
  if (!isArabic()) {
    return text
  }
  return text.replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)])
}

export function formatLocalTime(timestamp) {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return '—'
  }
  const minute = String(date.getMinutes()).padStart(2, '0')
  if (getTimeFormat() === TIME_FORMAT_12) {
    const rawHour = date.getHours()
    const hour = rawHour % 12 || 12
    const period = rawHour >= 12 ? t('time_pm') : t('time_am')
    return localizeDigits(`${hour}:${minute} ${period}`)
  }
  return localizeDigits(`${String(date.getHours()).padStart(2, '0')}:${minute}`)
}

export function formatLocalDayDate(timestamp) {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return '—'
  }
  const language = isArabic() ? 'ar' : 'en'
  return `${DAY_NAMES[language][date.getDay()]} • ${localizeDigits(
    date.getDate(),
  )} ${MONTH_NAMES[language][date.getMonth()]}`
}

export function formatMatchDayDate(timestamp, nowMs = Date.now()) {
  const date = new Date(timestamp)
  const now = new Date(nowMs)
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) {
    return '—'
  }
  const language = isArabic() ? 'ar' : 'en'
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const dayLabel = isToday
    ? t('today')
    : COMPACT_DAY_NAMES[language][date.getDay()]
  const monthLabel =
    language === 'en'
      ? MONTH_NAMES.en[date.getMonth()].toUpperCase()
      : MONTH_NAMES.ar[date.getMonth()]
  return `${dayLabel} · ${localizeDigits(date.getDate())} ${monthLabel}`
}

export function formatCompactDayTime(timestamp) {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return '—'
  }
  const language = isArabic() ? 'ar' : 'en'
  return `${COMPACT_DAY_NAMES[language][date.getDay()]} ${formatLocalTime(
    timestamp,
  )}`
}

export function formatLocalDate(timestamp) {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return '—'
  }
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  const format = getDateFormat()
  if (format === DATE_FORMAT_MDY) {
    return localizeDigits(`${month}/${day}/${year}`)
  }
  if (format === DATE_FORMAT_DMY) {
    return localizeDigits(`${day}/${month}/${year}`)
  }
  return localizeDigits(`${year}/${month}/${day}`)
}

export function formatLastUpdated(fetchedAt) {
  if (!Number.isFinite(Number(fetchedAt))) {
    return t('never')
  }
  return formatLocalTime(Number(fetchedAt))
}

export function formatScore(fixture) {
  if (!fixture) {
    return '—'
  }
  const home = fixture.homeTeam && fixture.homeTeam.score
  const away = fixture.awayTeam && fixture.awayTeam.score
  if (home === null || home === undefined || away === null || away === undefined) {
    return '—'
  }
  return localizeDigits(`${home} – ${away}`)
}

export function localizedStatus(status) {
  const key = {
    scheduled: 'status_scheduled',
    live: 'status_live',
    halftime: 'status_halftime',
    finished: 'status_finished',
    postponed: 'status_postponed',
    suspended: 'status_suspended',
    cancelled: 'status_cancelled',
  }[status]
  return t(key || 'status_scheduled')
}

export function formatStatusWithMinute(fixture) {
  if (!fixture) {
    return ''
  }
  if (fixture.status === 'live' && fixture.minute) {
    const minute = `${localizeDigits(fixture.minute)}′`
    return isRtl()
      ? `${localizedStatus('live')} • ${minute}`
      : `${minute} • ${localizedStatus('live')}`
  }
  return localizedStatus(fixture.status)
}
