// Loosely based on https://stackoverflow.com/a/63208885
export function queue(opsConcurrency = 3) {
  let runningOps = 0
  let operationQueue = []

  let Queue = {}

  Queue.queue = operationQueue

  Queue.enqueue = async function(op) {
    return new Promise((resolve, reject) => {
      operationQueue.push({ op, resolve, reject })
      Queue.dequeue()
    })
  }

  Queue.dequeue = async function() {
    if (runningOps < opsConcurrency) {
      let run = operationQueue.shift()

      if (!run) return false

      runningOps += 1

      run.op()
        .then(payload => {
          runningOps -= 1
          run.resolve(payload)
        })
        .catch(err => {
          runningOps -= 1
          run.reject(err)
        })
        .finally(() => {
          if (operationQueue.length > 0) {
            Queue.dequeue()
          }
        })

      return true
    } else {
      return false
    }
  }

  return Queue
}