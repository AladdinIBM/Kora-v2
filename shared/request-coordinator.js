import { ERROR_CODES, LOGICAL_TIMEOUT_MS } from './constants.js'
import { ClubPulseError } from './errors.js'

export class RequestCoordinator {
  constructor({
    timeoutMs = LOGICAL_TIMEOUT_MS,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}) {
    this.timeoutMs = timeoutMs
    this.setTimer = (...args) => Reflect.apply(setTimer, globalThis, args)
    this.clearTimer = (...args) => Reflect.apply(clearTimer, globalThis, args)
    this.inFlight = new Map()
    this.generations = new Map()
  }

  has(key) {
    return this.inFlight.has(key)
  }

  run(key, taskFactory, options = {}) {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)
    }

    const timeoutMs = options.timeoutMs ?? this.timeoutMs
    const generation = (this.generations.get(key) || 0) + 1
    this.generations.set(key, generation)

    const promise = new Promise((resolve, reject) => {
      let settled = false
      const timer = this.setTimer(() => {
        if (settled) {
          return
        }
        settled = true
        this.generations.set(key, generation + 1)
        reject(
          new ClubPulseError(
            ERROR_CODES.TIMEOUT,
            `Request timed out after ${timeoutMs}ms`,
          ),
        )
      }, timeoutMs)

      Promise.resolve()
        .then(taskFactory)
        .then(
          (value) => {
            if (
              settled ||
              this.generations.get(key) !== generation
            ) {
              return
            }
            settled = true
            this.clearTimer(timer)
            resolve(value)
          },
          (error) => {
            if (
              settled ||
              this.generations.get(key) !== generation
            ) {
              return
            }
            settled = true
            this.clearTimer(timer)
            reject(error)
          },
        )
    }).finally(() => {
      if (this.inFlight.get(key) === promise) {
        this.inFlight.delete(key)
      }
    })

    this.inFlight.set(key, promise)
    return promise
  }

  invalidate(key) {
    this.generations.set(key, (this.generations.get(key) || 0) + 1)
    this.inFlight.delete(key)
  }

  clear() {
    for (const key of this.inFlight.keys()) {
      this.invalidate(key)
    }
  }
}
